import { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import sessionManager from '../../services/sessionManager';

export const proxyToBrowser = (req: Request, res: Response, next: NextFunction) => {
  const { containerId } = req.params;
  const hostPort = sessionManager.getSessionHostPort(containerId);

  if (!hostPort) {
    res.status(404).json({ success: false, error: 'Session not found or not active' });
    return;
  }

  // Proxy to the browser container's hostPort
  return createProxyMiddleware({
    target: `http://localhost:${hostPort}`,
    changeOrigin: true,
    ws: true,
    pathRewrite: (path, req) => {
      // Remove /proxy/:containerId from the path
      const match = path.match(/^\/proxy\/[a-zA-Z0-9]+\/(.*)$/);
      return match ? `/${match[1]}` : '/';
    },
    onError: (err, req, res) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Proxy error', details: err.message }));
    },
  })(req, res, next);
}; 