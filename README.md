# 🧠 MindMap AI - Visual Thinking Map

An intelligent visual thinking map application that allows users to create branching conversations with AI, maintain context across questions, and explore topics visually.

## ✨ Features

- **🗺️ Visual Thinking Map**: Interactive canvas for creating mind maps
- **🤖 AI-Powered**: Integration with Groq API + Llama 3.1-8b-instant model
- **🧩 Context Awareness**: Advanced conversation context system that maintains topic coherence
- **🌿 Branching Conversations**: Create multiple conversation branches from any node
- **💬 Chat Interface**: Modern chat bubble style for AI responses
- **🎯 Click Positioning**: Choose where new nodes appear on the canvas
- **🚀 Unlimited Scrolling**: Expanded canvas with 4-directional navigation controls
- **⚡ Real-time**: Immediate AI responses with smooth animations
- **🎨 Modern UI**: Clean, responsive interface with drag-and-drop support

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/rdvankck/MindMap-AI.git
cd MindMap-AI
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
# Copy the example environment file
cp backend/.env.example backend/.env

# Edit the .env file and add your Groq API key
# Get your free API key from: https://console.groq.com/keys
```

4. **Start the application**
```bash
# Start both frontend and backend
npm run dev
```

Or start them individually:
```bash
# Frontend (port 3000)
npm run dev:frontend

# Backend (port 3002) 
npm run dev:backend
```

### Environment Variables

Create a `backend/.env` file with:

```env
# Groq API Configuration (Free Llama 3)
GROQ_API_KEY=your_groq_api_key_here
GROQ_API_URL=https://api.groq.com/openai/v1/chat/completions
GROQ_TIMEOUT=120000

# Database Configuration
DATABASE_URL=postgresql://your_db_url

# Server Configuration
PORT=3002
NODE_ENV=development
```

Get your free Groq API key from [https://console.groq.com/keys](https://console.groq.com/keys)

## 🎯 Usage

1. **Open the application** at http://localhost:3000
2. **Start with a question** in the initial node
3. **Click the expand button** to get AI responses at any position
4. **Use the + button** on answer nodes to add follow-up questions
5. **Create branches** to explore different aspects of your topic
6. **Drag nodes** to organize your thinking map
7. **Navigate the canvas** using unlimited scrolling controls

## 🧠 Context System

The application features an advanced context system that:

- **Maintains conversation flow** across questions and answers
- **Remembers related questions** from the same branch
- **Provides topic coherence** for intelligent responses
- **Supports multi-branch conversations** with independent contexts
- **Separates main topic** from branch contexts for focused discussions

## 🚀 Canvas Navigation

The application features an advanced canvas navigation system with unlimited scrolling capabilities:

### Navigation Controls
- **🎮 Directional Buttons**: Four-directional navigation buttons (up, down, left, right) in the toolbar
- **🖱️ Mouse Wheel**: Normal vertical scrolling with mouse wheel
- **⚡ Shift+Wheel**: 5x faster horizontal scrolling with Shift key
- **🤏 Drag & Pan**: Click and drag empty canvas space to pan around

### Canvas Specifications
- **📐 Massive Canvas Area**: 500vw × 500vh (50,000px minimum)
- **🔍 Extreme Zoom**: 0.01x to 5x zoom levels
- **🎯 Smooth Scrolling**: 2,000px scroll increments with smooth animations
- **♾️ Unlimited Space**: Virtually unlimited workspace for complex mind maps

### Keyboard Shortcuts
- **Shift + Mouse Wheel**: Fast horizontal scrolling
- **Mouse Wheel**: Vertical scrolling  
- **Click & Drag**: Pan canvas freely
- **Ctrl/Cmd + Scroll**: Zoom in/out

## 🛠️ Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for development and building
- **Canvas-based UI** with SVG connections
- **Drag and Drop** functionality
- **Modern CSS** with animations

### Backend  
- **Node.js** with Express
- **TypeScript** for type safety
- **Groq API** integration (Llama 3.1-8b-instant)
- **CORS** enabled
- **Structured error handling**

## 📱 Features Explained

### Visual Thinking Map
- Interactive canvas with grid background
- Draggable nodes with smooth animations
- SVG connections showing relationships
- Click-to-position for new nodes
- Unlimited scrolling workspace

### Canvas Navigation
- Four-directional navigation controls (up, down, left, right)
- Massive canvas area (500vw × 500vh)
- Extreme zoom levels (0.01x to 5x)
- Smooth scrolling with 2,000px increments
- Multiple input methods (buttons, mouse wheel, drag & pan)

### AI Integration
- Free Groq API with Llama 3.1 model
- Intelligent conversation context
- Fast response times
- Fallback error handling

### Context Management
- Builds conversation history from node tree
- Maintains context across branches
- Intelligent topic coherence
- Related question awareness
- Main topic vs branch separation

## 🔧 Development

### Project Structure
```
MindMap-AI/
├── frontend/           # React frontend
│   ├── src/
│   │   ├── pages/
│   │   │   └── VisualThinkingMap.tsx
│   │   └── ...
│   └── package.json
├── backend/           # Node.js backend
│   ├── src/
│   │   └── simple-server.ts
│   ├── .env
│   └── package.json
├── .gitignore
└── README.md
```

### Available Scripts
```bash
npm run dev          # Start both frontend and backend
npm run dev:frontend # Start frontend only
npm run dev:backend  # Start backend only
npm run build        # Build for production
npm run test         # Run tests
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Groq** for providing free AI API access
- **Llama 3.1** for the powerful language model
- **React** and **Vite** for the excellent development experience
- **TypeScript** for type safety

## 🔗 Links

- **Live Demo**: [Coming Soon]
- **API Documentation**: [View Documentation](docs/API.md)
- **Issues**: [GitHub Issues](https://github.com/rdvankck/MindMap-AI/issues)

---
