import Docker from 'dockerode';
import type { Container } from 'dockerode';
import { ContainerInfo } from '../types';
import config from '../config';
import logger from '../utils/logger';

class DockerService {
  private docker: Docker;
  private maxRetries = 3;
  private retryDelay = 1000;

  constructor() {
    // For Windows Docker Desktop, use the default Docker host
    // For Linux, use the socket path
    const isWin = process.platform === 'win32';
    if (isWin) {
      // On Windows, Docker Desktop exposes the daemon on tcp://localhost:2375 or uses named pipes
      // The dockerode library will automatically detect the correct connection method
      this.docker = new Docker();
    } else {
      // On Linux, use the socket
      this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
    }
    
    // Test the connection immediately
    this.testConnection();
  }

  private async testConnection(): Promise<void> {
    try {
      await this.docker.ping();
      logger.info('Docker connection established successfully');
    } catch (error) {
      logger.error('Failed to connect to Docker daemon', {
        error: (error as Error).message,
        platform: process.platform,
      });
      
      // For now, just log the error but don't try alternative methods
      // as they may not work in the containerized environment
    }
  }

  public async startContainer(image?: string): Promise<ContainerInfo> {
    const startTime = Date.now();
    const containerImage = image || config.docker.image;

    try {
      logger.info('Starting container', { image: containerImage });

      // Check if we're at capacity
      const activeContainers = await this.getActiveContainersCount();
      if (activeContainers >= config.sessions.maxSessions) {
        throw new Error(`Maximum number of sessions (${config.sessions.maxSessions}) reached`);
      }

      // Validate image exists or pull it
      await this.ensureImageExists(containerImage);

      // DEBUG: Log the container create options
      logger.debug('Creating container with options', {
        Image: containerImage,
        Tty: false,
        Env: config.docker.environment,
        HostConfig: {
          PortBindings: config.docker.portBindings,
          PublishAllPorts: true,
          ShmSize: config.docker.shmSize,
          SecurityOpt: ['seccomp=unconfined'],
          Memory: this.parseMemoryLimit(config.docker.memoryLimit),
          CpuQuota: Math.floor(config.docker.cpuLimit * 100000),
          CpuPeriod: 100000,
          RestartPolicy: {
            Name: 'no',
          },
          AutoRemove: true,
        },
        ExposedPorts: {
          '3000/tcp': {},
          '3001/tcp': {},
        },
        Labels: {
          'disposable-suite': 'true',
          'created-by': 'disposable-suite',
          'created-at': new Date().toISOString(),
        },
      });

      const container = await this.docker.createContainer({
        Image: containerImage,
        Tty: false,
        Env: config.docker.environment,
        HostConfig: {
          PortBindings: config.docker.portBindings,
          PublishAllPorts: true,
          ShmSize: config.docker.shmSize,
          SecurityOpt: ['seccomp=unconfined'],
          Memory: this.parseMemoryLimit(config.docker.memoryLimit),
          CpuQuota: Math.floor(config.docker.cpuLimit * 100000),
          CpuPeriod: 100000,
          RestartPolicy: {
            Name: 'no',
          },
          AutoRemove: true,
        },
        ExposedPorts: {
          '3000/tcp': {},
          '3001/tcp': {},
        },
        Labels: {
          'disposable-suite': 'true',
          'created-by': 'disposable-suite',
          'created-at': new Date().toISOString(),
        },
      });

      logger.debug('Container created', { containerId: container.id });

      await this.startContainerWithRetry(container);

      // Wait for Docker to assign a host port
      const hostPort = await this.waitForHostPort(container);
      const info = await container.inspect(); // for logging and status
      logger.debug('Container inspect info', { inspect: info });
      if (hostPort === 0) {
        logger.warn('Container started but hostPort is 0. Port mapping may have failed.', {
          containerId: container.id,
          ports: info.NetworkSettings.Ports,
          hostConfig: info.HostConfig,
        });
      }

      const duration = Date.now() - startTime;
      logger.info('Container started successfully', {
        containerId: container.id,
        hostPort,
        image: containerImage,
        duration: `${duration}ms`,
      });

      return {
        id: container.id,
        hostPort,
        status: info.State.Status as 'running' | 'stopped' | 'removed',
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to start container', {
        image: containerImage,
        error: (error as Error).message,
        duration: `${duration}ms`,
      });
      throw error;
    }
  }

  public async stopContainer(containerId: string): Promise<boolean> {
    const startTime = Date.now();

    try {
      logger.info('Stopping container', { containerId });

      const container = this.docker.getContainer(containerId);
      const info = await container.inspect();

      if (info.State.Status === 'running') {
        await container.stop({ t: 10 }); // 10 second timeout
      }

      await container.remove({ force: true });

      const duration = Date.now() - startTime;
      logger.info('Container stopped successfully', {
        containerId,
        duration: `${duration}ms`,
      });

      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to stop container', {
        containerId,
        error: (error as Error).message,
        duration: `${duration}ms`,
      });
      return false;
    }
  }

  public async getContainerInfo(containerId: string): Promise<ContainerInfo | null> {
    try {
      const container = this.docker.getContainer(containerId);
      const info = await container.inspect();
      const portInfo = info.NetworkSettings.Ports['3000/tcp'];
      const hostPort = portInfo?.[0]?.HostPort ? parseInt(portInfo[0].HostPort, 10) : 0;
      return {
        id: containerId,
        hostPort,
        status: info.State.Status as 'running' | 'stopped' | 'removed',
      };
    } catch (error) {
      logger.error('Failed to get container info', {
        containerId,
        error: (error as Error).message,
      });
      return null;
    }
  }

  public async getActiveContainersCount(): Promise<number> {
    try {
      const containers = await this.docker.listContainers({
        filters: {
          label: ['disposable-suite=true'],
          status: ['running'],
        },
      });
      return containers.length;
    } catch (error) {
      logger.error('Failed to get active containers count', {
        error: (error as Error).message,
      });
      return 0;
    }
  }

  public async cleanupOrphanedContainers(): Promise<number> {
    try {
      const containers = await this.docker.listContainers({
        all: true,
        filters: {
          label: ['disposable-suite=true'],
        },
      });

      let cleanedCount = 0;
      for (const containerInfo of containers) {
        const container = this.docker.getContainer(containerInfo.Id);
        
        try {
          if (containerInfo.State === 'exited' || containerInfo.State === 'dead') {
            await container.remove({ force: true });
            cleanedCount++;
            logger.info('Cleaned up orphaned container', { containerId: containerInfo.Id });
          }
        } catch (error) {
          logger.error('Failed to cleanup orphaned container', {
            containerId: containerInfo.Id,
            error: (error as Error).message,
          });
        }
      }

      if (cleanedCount > 0) {
        logger.info('Cleanup completed', { cleanedCount });
      }

      return cleanedCount;
    } catch (error) {
      logger.error('Failed to cleanup orphaned containers', {
        error: (error as Error).message,
      });
      return 0;
    }
  }

  public async getSystemStats(): Promise<Record<string, any>> {
    try {
      const info = await this.docker.info();
      const activeContainers = await this.getActiveContainersCount();
      
      return {
        dockerVersion: info.ServerVersion,
        containers: info.Containers,
        activeContainers,
        images: info.Images,
        memory: info.MemTotal,
        cpuCount: info.NCPU,
        operatingSystem: info.OperatingSystem,
        kernelVersion: info.KernelVersion,
      };
    } catch (error) {
      logger.error('Failed to get Docker system stats', {
        error: (error as Error).message,
      });
      return {};
    }
  }

  private async ensureImageExists(image: string): Promise<void> {
    try {
      await this.docker.getImage(image).inspect();
      logger.debug('Image exists locally', { image });
    } catch (error) {
      logger.info('Pulling image', { image });
      await this.docker.pull(image);
      logger.info('Image pulled successfully', { image });
    }
  }

  private async startContainerWithRetry(container: Container): Promise<void> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await container.start();
        return;
      } catch (error) {
        if (attempt === this.maxRetries) {
          throw error;
        }
        logger.warn('Container start attempt failed, retrying', {
          attempt,
          maxRetries: this.maxRetries,
          error: (error as Error).message,
        });
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
      }
    }
  }

  private parseMemoryLimit(memoryLimit: string): number {
    const units: Record<string, number> = {
      'b': 1,
      'k': 1024,
      'm': 1024 * 1024,
      'g': 1024 * 1024 * 1024,
    };

    const match = memoryLimit.match(/^(\d+)([bkmg])?$/i);
    if (!match) {
      throw new Error(`Invalid memory limit format: ${memoryLimit}`);
    }

    const value = parseInt(match[1]!, 10);
    const unit = (match[2] || 'b').toLowerCase();
    
    return value * units[unit]!;
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.docker.ping();
      return true;
    } catch (error) {
      logger.error('Docker health check failed', {
        error: (error as Error).message,
      });
      return false;
    }
  }

  // Wait for Docker to assign a host port after starting the container
  private async waitForHostPort(container: Container, timeoutMs = 5000): Promise<number> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const info = await container.inspect();
      const portInfo = info.NetworkSettings.Ports['3000/tcp'];
      const hostPort = Array.isArray(portInfo) && portInfo[0]?.HostPort ? parseInt(portInfo[0].HostPort, 10) : 0;
      if (hostPort > 0) {
        return hostPort;
      }
      await new Promise(res => setTimeout(res, 100)); // wait 100ms before retry
    }
    return 0; // fallback if not assigned in time
  }
}

export default new DockerService(); 