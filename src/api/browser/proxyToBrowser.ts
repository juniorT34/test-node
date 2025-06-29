import { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import sessionManager from '../../services/sessionManager';

export const proxyToBrowser = (req: Request, res: Response, next: NextFunction): void => {
  const containerId = req.params['containerId'] || '';
  const hostPort = sessionManager.getSessionHostPort(containerId);

  if (typeof hostPort !== 'number' || isNaN(hostPort)) {
    res.status(404).json({ success: false, error: 'Session not found or not active' });
    return;
  }

  // Return the middleware function directly
  const proxy = createProxyMiddleware({
    target: `http://localhost:${hostPort.toString()}`,
    changeOrigin: true,
    ws: true,
    pathRewrite: (path: string, _req: Request) => {
      // Remove /proxy/:containerId from the path
      const match = path.match(/^\/proxy\/[a-zA-Z0-9]+\/(.*)$/);
      return match ? `/${match[1]}` : '/';
    }
  });
  proxy(req, res, next);
}; 