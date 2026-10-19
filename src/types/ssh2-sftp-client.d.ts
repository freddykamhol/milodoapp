declare module "ssh2-sftp-client" {
  // minimal typing for server-side use
  export default class SftpClient {
    connect(config: Record<string, unknown>): Promise<void>;
    end(): Promise<void>;
    mkdir(path: string, recursive?: boolean): Promise<void>;
    exists(path: string): Promise<false | string>;
    put(input: Buffer | Uint8Array | string, remotePath: string): Promise<unknown>;
    get(remotePath: string): Promise<unknown>;
    rename(fromPath: string, toPath: string): Promise<unknown>;
    delete(remotePath: string): Promise<unknown>;
    rmdir(remotePath: string, recursive?: boolean): Promise<unknown>;
  }
}

