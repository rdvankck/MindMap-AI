import React, { useState, useEffect, useRef } from 'react';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

interface Branch {
  id: string;
  conversationId: string;
  name: string;
  parentId: string | null;
  data: {
    messages: Message[];
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Conversation {
  id: string;
  title: string;
  userId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  branches: Branch[];
}

const AdvancedChatInterface: React.FC = () => {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [activeBranchId, setActiveBranchId] = useState<string>('main');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [conversationId] = useState('conv-demo-' + Date.now());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversation();
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadConversation = async () => {
    try {
      const response = await fetch(`http://localhost:3002/api/conversations/${conversationId}`);
      if (response.ok) {
        const data = await response.json();
        setConversation(data);
        const activeBranch = data.branches.find((b: Branch) => b.isActive);
        if (activeBranch) {
          setActiveBranchId(activeBranch.id);
          setMessages(activeBranch.data.messages || []);
        }
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: inputMessage,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3002/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputMessage,
          model: 'gpt-3.5-turbo',
          conversationId,
          branchId: activeBranchId
        })
      });

      if (response.ok) {
        const data = await response.json();
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: data.response,
          timestamp: data.timestamp
        };
        setMessages(prev => [...prev, aiMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createBranch = async () => {
    if (!newBranchName.trim()) return;

    try {
      const response = await fetch(`http://localhost:3002/api/conversations/${conversationId}/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newBranchName,
          parentId: activeBranchId,
          data: { messages }
        })
      });

      if (response.ok) {
        setShowBranchModal(false);
        setNewBranchName('');
        loadConversation(); // Reload to show new branch
      }
    } catch (error) {
      console.error('Error creating branch:', error);
    }
  };

  const switchBranch = async (branchId: string) => {
    try {
      const response = await fetch(`http://localhost:3002/api/conversations/${conversationId}/branches/${branchId}/activate`, {
        method: 'PUT'
      });

      if (response.ok) {
        setActiveBranchId(branchId);
        loadConversation();
      }
    } catch (error) {
      console.error('Error switching branch:', error);
    }
  };

  const buildTreeStructure = (branches: Branch[]) => {
    const tree: any = {};
    const roots: any[] = [];

    branches.forEach(branch => {
      tree[branch.id] = { ...branch, children: [] };
    });

    branches.forEach(branch => {
      if (branch.parentId && tree[branch.parentId]) {
        tree[branch.parentId].children.push(tree[branch.id]);
      } else {
        roots.push(tree[branch.id]);
      }
    });

    return roots;
  };

  const renderTreeNode = (node: Branch, level: number = 0) => (
    <div key={node.id} style={{ marginLeft: `${level * 20}px` }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 12px',
          margin: '4px 0',
          borderRadius: '8px',
          backgroundColor: node.isActive ? '#e3f2fd' : '#f5f5f5',
          border: node.isActive ? '2px solid #2196f3' : '1px solid #ddd',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
        onClick={() => switchBranch(node.id)}
      >
        <div style={{ marginRight: '8px' }}>
          {node.isActive ? '🌟' : '📍'}
        </div>
        <div>
          <div style={{ fontWeight: node.isActive ? 'bold' : 'normal' }}>
            {node.name}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {node.data.messages?.length || 0} messages
          </div>
        </div>
      </div>
      {node.children && node.children.map((child: Branch) => renderTreeNode(child, level + 1))}
    </div>
  );

  if (!conversation) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Loading conversation...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* Sidebar - Conversation Tree */}
      <div style={{
        width: '300px',
        backgroundColor: 'white',
        borderRight: '1px solid #ddd',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #ddd',
          backgroundColor: '#2196f3',
          color: 'white'
        }}>
          <h3 style={{ margin: 0, fontSize: '18px' }}>Conversation Tree</h3>
          <p style={{ margin: '5px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
            {conversation.title}
          </p>
        </div>
        
        <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
          <div style={{ marginBottom: '20px' }}>
            <button
              onClick={() => setShowBranchModal(true)}
              style={{
                padding: '10px 15px',
                backgroundColor: '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                width: '100%',
                fontSize: '14px'
              }}
            >
              ➕ Create New Branch
            </button>
          </div>
          
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>
            Branches ({conversation.branches.length})
          </h4>
          {buildTreeStructure(conversation.branches).map(node => renderTreeNode(node))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          backgroundColor: 'white',
          borderBottom: '1px solid #ddd',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <button
                onClick={() => window.history.back()}
                style={{
                  marginRight: '15px',
                  padding: '8px 15px',
                  backgroundColor: '#f5f5f5',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  color: '#666'
                }}
              >
                ← Back
              </button>
              <div>
                <h2 style={{ margin: 0, color: '#333' }}>Advanced Chat Interface</h2>
                <p style={{ margin: '5px 0 0 0', color: '#666' }}>
                  Active Branch: <strong>{conversation.branches.find(b => b.id === activeBranchId)?.name}</strong>
                </p>
              </div>
            </div>
            <div style={{
              padding: '8px 16px',
              backgroundColor: '#4caf50',
              color: 'white',
              borderRadius: '20px',
              fontSize: '14px'
            }}>
              🟢 Connected
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div style={{
          flex: 1,
          padding: '20px',
          overflowY: 'auto',
          backgroundColor: '#fafafa'
        }}>
          {messages.map((message) => (
            <div
              key={message.id}
              style={{
                display: 'flex',
                justifyContent: message.sender === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: '20px'
              }}
            >
              <div
                style={{
                  maxWidth: '70%',
                  padding: '15px 20px',
                  borderRadius: '18px',
                  backgroundColor: message.sender === 'user' ? '#2196f3' : 'white',
                  color: message.sender === 'user' ? 'white' : '#333',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ marginRight: '8px', fontSize: '18px' }}>
                    {message.sender === 'user' ? '👤' : '🤖'}
                  </span>
                  <strong>{message.sender === 'user' ? 'You' : 'AI Assistant'}</strong>
                </div>
                <div style={{ lineHeight: '1.4' }}>{message.text}</div>
                <div style={{
                  fontSize: '12px',
                  opacity: 0.7,
                  marginTop: '8px',
                  textAlign: 'right'
                }}>
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '20px' }}>
              <div style={{
                padding: '15px 20px',
                borderRadius: '18px',
                backgroundColor: 'white',
                boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ marginRight: '8px' }}>🤖</span>
                  <div className="typing-indicator">
                    <span>AI is thinking</span>
                    <span className="dots">...</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={{
          padding: '20px',
          backgroundColor: 'white',
          borderTop: '1px solid #ddd'
        }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type your message..."
              style={{
                flex: 1,
                padding: '15px 20px',
                border: '2px solid #ddd',
                borderRadius: '25px',
                fontSize: '16px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !inputMessage.trim()}
              style={{
                padding: '15px 30px',
                backgroundColor: isLoading ? '#ccc' : '#2196f3',
                color: 'white',
                border: 'none',
                borderRadius: '25px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            >
              {isLoading ? '...' : 'Send'}
            </button>
          </div>
        </div>
      </div>

      {/* Branch Creation Modal */}
      {showBranchModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '15px',
            width: '400px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ marginTop: 0, color: '#333' }}>Create New Branch</h3>
            <p style={{ color: '#666', marginBottom: '20px' }}>
              Create a new conversation branch from the current point
            </p>
            <input
              type="text"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              placeholder="Branch name..."
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #ddd',
                borderRadius: '8px',
                fontSize: '16px',
                marginBottom: '20px'
              }}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowBranchModal(false);
                  setNewBranchName('');
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#f5f5f5',
                  color: '#666',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={createBranch}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#4caf50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Create Branch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedChatInterface;