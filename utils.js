import * as child_process from "node:child_process";
import * as path from 'node:path';

/**
 * @typedef {Object} ChildProcessResult
 * @property {string} stdout
 * @property {string} stderr
 * @property {number} code
 */

/**
 *
 * @param {Readable} readable
 * @param {BufferEncoding=} encoding
 */
export async function readStream (readable, encoding = 'utf8') {
  readable.setEncoding(encoding)

  return new Promise((resolve, reject) => {
    /**
     *
     * @type {string[]}
     */
    const buffer = [];

    readable.on('readable', () => {
      const data = readable.read()
      if (data != null) {
        buffer.push(data)
      }
    })

    readable.on('end', () => {
      resolve(buffer.join(''));
    })

    readable.on('error', reject)
  })
}

/**
 *
 * @param {ChildProcess} cp
 * @returns {Promise<ChildProcessResult>}
 */
export async function waitChildProcess (cp) {
  const stdoutPromise = readStream(cp.stdout);
  const stderrPromise = readStream(cp.stderr);
  const processPromise = new Promise((resolve, reject) => {
    cp.on('exit', (code) => {
      resolve(code);
    })
  })

  const [stdout, stderr, code] = await Promise.all([stdoutPromise, stderrPromise, processPromise]);

  return {
    stdout,
    stderr,
    code,
  }
}

export async function checkTiUPVersion (bin) {
  const proc = child_process.exec(`bash -c "${bin} -v"`)

  const { stdout, code } = await waitChildProcess(proc);

  if (code === 0) {
    return stdout.split(' ', 2)[0]
  }
  return null
}

export async function installTiUP () {
  const installScript = await fetch('https://tiup-mirrors.pingcap.com/install.sh')
    .then(res => {
      if (!res.ok) {
        throw new Error(`Failed to fetch install.sh: ${res.statusText}`)
      }
      return res.text()
    })

  const proc = child_process.exec(installScript)

  const { stdout, stderr, code } = await waitChildProcess(proc);

  if (code === 0) {
    const PREFIX = 'Installed path: ';
    const line = stdout.split('\n')
      .find(line => line.startsWith(PREFIX));

    if (!line) {
      throw new Error(`Failed to install TiUP: Cannot extract installed path`)
    }

    return path.dirname(line.slice(PREFIX.length).trim());
  } else {
    throw new Error(`Failed to install TiUP: ${stderr}`)
  }
}


/**
 * @typedef {Object} PlaygroundClusterOptions
 * @property {string?} version
 * @property {string} tag
 * @property {number?} db
 * @property {number?} kv
 * @property {number?} pd
 * @property {number?} tiflash
 * @property {boolean?} withoutMonitor
 *
 */

/**
 *
 * @param {string} bin
 * @param {PlaygroundClusterOptions} options
 */
export function startCluster (bin, options) {
  const args = ['playground']

  if (options.version) {
    args.push(options.version)
  }

  args.push('--tag', options.tag)

  if (options.withoutMonitor) {
    args.push('--without-monitor')
  }

  for (const name of ['db', 'pd', 'tiflash', 'kv']) {
    if (options.db) {
      args.push(`--${name}`, String(options.db))
    } else {
      args.push(`--${name}`, '1')
    }
  }

  args.push(
    '--db.host', '0.0.0.0',
    '--pd.host', '0.0.0.0'
  )

  const cp = child_process.spawn(bin, args, {
    detached: true,
    stdio: 'ignore',
  })
  if (!cp.pid) {
    throw new Error('Failed to start tiup playground')
  }
  cp.unref()
}

/**
 *
 * @param {string} bin
 * @param {string} clusterId
 * @returns {Promise<void>}
 */
export function stopCluster (bin, clusterId) {
  const cp = child_process.spawn(bin, ['clean', clusterId])
  if (!cp.pid) {
    throw new Error('Failed to stop tiup playground')
  }

  return new Promise((resolve, reject) => {
    cp.on('exit', () => {
      resolve()
    })
    cp.on('error', err => {
      reject(err)
    })
  })
}

/**
 * @param {string} bin
 * @param {string} clusterId
 * @returns {Promise<void>}
 */
export async function checkClusterStatus (bin, clusterId) {
  const cp = child_process.exec(`bash -c "echo 'SELECT 1;' | ${bin} client ${clusterId}"`)
  if (!cp.pid) {
    throw new Error('Failed to stop tiup playground')
  }

  return new Promise(async (resolve, reject) => {
    cp.on('exit', (code) => {
      resolve(code === 0)
    })
    cp.on('error', err => {
      reject(err)
    })

  })
}