# Disposable Suite - Production-Ready Backend

A robust, scalable backend system for managing disposable browser sessions using Docker containers. Built with Node.js, TypeScript, and Express, featuring comprehensive monitoring, security, and persistence.

## 🚀 Features

- **TypeScript Support**: Full type safety and modern JavaScript features
- **Docker Integration**: Automated container management for browser sessions
- **Redis Persistence**: Session storage with Redis for scalability
- **Comprehensive Logging**: Structured logging with Winston and file rotation
- **Security**: Helmet, CORS, rate limiting, and input validation
- **Monitoring**: Real-time status monitoring and health checks
- **API Documentation**: Auto-generated Swagger documentation
- **Testing**: Jest integration tests with supertest
- **Production Ready**: Docker Compose, Nginx, SSL support

## 📋 Prerequisites

- Node.js 18+ 
- Docker and Docker Compose
- Redis (optional, for session persistence)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd disposable-suite
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Build the application**
   ```bash
   npm run build
   ```

## 🚀 Quick Start

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Docker Compose (Recommended for Production)
```bash
docker-compose up -d
```

## 📚 API Documentation

Once the server is running, visit:
- **Swagger UI**: `http://localhost:8080/api-docs`
- **Health Check**: `http://localhost:8080/health`
- **Status Monitor**: `http://localhost:8080/status` (if enabled)

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `4000` |
| `HOST` | Server host | `0.0.0.0` |
| `BROWSER_IMAGE` | Docker image for browser sessions | `linuxserver/firefox:latest` |
| `DEFAULT_SESSION_MS` | Default session duration (ms) | `300000` (5 min) |
| `MAX_SESSIONS` | Maximum concurrent sessions | `10` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `SESSION_PERSISTENCE_ENABLED` | Enable Redis persistence | `true` |
| `ENABLE_MONITORING` | Enable status monitoring | `true` |

### Docker Configuration

The application includes comprehensive Docker support:

- **Multi-stage Dockerfile** for optimized production builds
- **Docker Compose** for complete stack deployment
- **Nginx reverse proxy** with SSL support
- **Redis** for session persistence
- **Health checks** for all services

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## 📊 Monitoring

### Health Checks
- Application health: `GET /health`
- Docker service health checks
- Redis connectivity monitoring

### Status Monitoring
- Real-time metrics dashboard
- CPU, memory, and response time monitoring
- Request rate and status code tracking

### Logging
- Structured JSON logging
- File rotation with compression
- Separate error logs
- Request/response logging

## 🔒 Security Features

- **Helmet.js**: Security headers
- **CORS**: Configurable cross-origin requests
- **Rate Limiting**: Redis-backed rate limiting
- **Input Validation**: Express-validator integration
- **Content Security Policy**: XSS protection
- **HTTPS Support**: SSL/TLS configuration

## 📈 Performance

- **Compression**: Gzip compression for responses
- **Connection Pooling**: Redis connection optimization
- **Memory Management**: Automatic session cleanup
- **Resource Limits**: Docker container resource constraints

## 🏗️ Architecture

```
src/
├── api/                 # API routes and controllers
│   └── browser/        # Browser session management
├── config/             # Configuration management
├── models/             # Data models and storage
├── services/           # Business logic services
├── utils/              # Utility functions
├── tests/              # Test files
├── types/              # TypeScript type definitions
├── app.ts              # Express application setup
└── server.ts           # Server entry point
```

## 🚀 Deployment

### Docker Compose (Recommended)
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

### Manual Deployment
1. Build the application: `npm run build`
2. Set up environment variables
3. Start Redis (if using persistence)
4. Run the application: `npm start`

### Production Considerations
- Use a process manager like PM2
- Set up SSL certificates
- Configure proper logging
- Set up monitoring and alerting
- Use a reverse proxy (Nginx)
- Implement backup strategies

## 🔧 Development

### Code Quality
```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Type checking
npm run type-check
```

### Building
```bash
# Build for production
npm run build

# Clean build artifacts
npm run clean
```

## 📝 API Endpoints

### Session Management
- `POST http://localhost:8080/api/browser/start-session` - Create a new browser session
  - **Body:** `{ "durationMs": 300000, "userId": "optional-user-id" }`
- `POST http://localhost:8080/api/browser/stop-session` - Stop an active session
  - **Body:** `{ "containerId": "<containerId>" }`
- `GET http://localhost:8080/api/browser/remaining-time?containerId=<containerId>` - Get session remaining time
- `POST http://localhost:8080/api/browser/extend-session` - Extend session duration
  - **Body:** `{ "containerId": "<containerId>", "extendByMs": 60000 }`

### System
- `GET http://localhost:8080/health` - Health check
- `GET http://localhost:8080/status` - Status monitoring (if enabled)
- `GET http://localhost:8080/api-docs` - API documentation

## 🧪 Example API Requests

### Start Session
```bash
curl -X POST "http://localhost:8080/api/browser/start-session" \
  -H "Content-Type: application/json" \
  -d '{ "durationMs": 300000, "userId": "test-user" }'
```

### Stop Session
```bash
curl -X POST "http://localhost:8080/api/browser/stop-session" \
  -H "Content-Type: application/json" \
  -d '{ "containerId": "<containerId>" }'
```

### Get Remaining Time
```bash
curl "http://localhost:8080/api/browser/remaining-time?containerId=<containerId>"
```

### Extend Session
```bash
curl -X POST "http://localhost:8080/api/browser/extend-session" \
  -H "Content-Type: application/json" \
  -d '{ "containerId": "<containerId>", "extendByMs": 60000 }'
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the API documentation
- Review the logs for debugging information

## 🔄 Changelog

### v1.0.0
- Initial production release
- TypeScript migration
- Comprehensive testing
- Docker support
- Redis persistence
- Security improvements
- Monitoring and logging 