declare module 'dockerode' {
  export default class Docker {
    constructor(options?: { socketPath?: string });
    createContainer(options: any): Promise<Container>;
    getContainer(id: string): Container;
    listContainers(options?: any): Promise<ContainerInfo[]>;
    getImage(name: string): Image;
    pull(name: string): Promise<any>;
    info(): Promise<any>;
    ping(): Promise<any>;
  }

  export interface Container {
    id: string;
    start(): Promise<void>;
    stop(options?: { t?: number }): Promise<void>;
    remove(options?: { force?: boolean }): Promise<void>;
    inspect(): Promise<ContainerInspectInfo>;
  }

  export interface Image {
    inspect(): Promise<any>;
  }

  export interface ContainerInfo {
    Id: string;
    State: string;
  }

  export interface ContainerInspectInfo {
    Id: string;
    State: {
      Status: string;
    };
    NetworkSettings: {
      Ports: {
        [key: string]: Array<{ HostPort: string }> | null;
      };
    };
    HostConfig: {
      PortBindings?: {
        [key: string]: Array<{ HostPort: string }> | null;
      };
      [key: string]: any;
    };
  }
} 