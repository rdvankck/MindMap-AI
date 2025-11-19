import React from 'react';

const WorkflowDemo: React.FC = () => {
  const handleOpenEditor = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/workflows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Demo Workflow',
          description: 'Test workflow from frontend',
          nodes: [],
          edges: []
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        alert('🛠️ Workflow Editor başarıyla açıldı!\n\nID: ' + data.id);
      } else {
        alert('❌ Workflow oluşturulamadı.');
      }
    } catch (error) {
      alert('⚠️ Backend bağlantısı başarısız!\n\nBackend sunucusunun http://localhost:3001 adresinde çalıştığından emin olun.');
    }
  };

  const handleStartChat = () => {
    // Navigate to Visual Thinking Map
    window.location.href = '/thinking-map';
  };

  const handleSettings = () => {
    alert('⚙️ Settings sayfasına yönlendiriliyor...\n\nBu özellik auth sistemi gerektirir.');
  };
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#ffffff',
      padding: '20px'
    }}>
      {/* Header */}
      <div style={{
        borderBottom: '2px solid #e5e7eb',
        paddingBottom: '20px',
        marginBottom: '30px'
      }}>
        <h1 style={{ 
          fontSize: '32px', 
          fontWeight: 'bold', 
          color: '#1f2937',
          margin: '0'
        }}>
          🤖 LLM Interface
        </h1>
        <p style={{ 
          color: '#6b7280', 
          margin: '5px 0 0 0' 
        }}>
          AI-Powered Workflow Builder
        </p>
      </div>
      
      {/* Main Content */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div style={{
          marginBottom: '40px'
        }}>
          <h2 style={{ 
            fontSize: '36px', 
            fontWeight: 'bold', 
            color: '#1f2937',
            marginBottom: '10px'
          }}>
            🚀 LLM Interface Demo
          </h2>
          <p style={{ 
            fontSize: '18px', 
            color: '#6b7280',
            lineHeight: '1.6'
          }}>
            Welcome to the LLM Interface! This is a powerful tool for creating 
            AI-powered workflows using a visual node-based editor.
          </p>
        </div>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '30px',
          marginBottom: '50px'
        }}>
          <div style={{
            border: '2px solid #e5e7eb',
            borderRadius: '12px',
            padding: '30px',
            backgroundColor: '#f9fafb'
          }}>
            <h3 style={{ 
              fontSize: '24px', 
              fontWeight: 'bold', 
              marginBottom: '15px',
              color: '#1f2937'
            }}>
              🛠️ Workflow Editor
            </h3>
            <p style={{ 
              color: '#6b7280', 
              marginBottom: '20px',
              lineHeight: '1.5'
            }}>
              Create and edit AI-powered workflows with visual node editor
            </p>
            <button 
              onClick={handleOpenEditor}
              style={{
                padding: '12px 24px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              Open Editor
            </button>
          </div>
          
          <div style={{
            border: '2px solid #e5e7eb',
            borderRadius: '12px',
            padding: '30px',
            backgroundColor: '#f9fafb'
          }}>
            <h3 style={{ 
              fontSize: '24px', 
              fontWeight: 'bold', 
              marginBottom: '15px',
              color: '#1f2937'
            }}>
              🧠 Visual Thinking Map
            </h3>
            <p style={{ 
              color: '#6b7280', 
              marginBottom: '20px',
              lineHeight: '1.5'
            }}>
              Create interactive visual conversations with branching paths
            </p>
            <button 
              onClick={handleStartChat}
              style={{
                padding: '12px 24px',
                backgroundColor: '#9333ea',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              Open Thinking Map
            </button>
          </div>
          
          <div style={{
            border: '2px solid #e5e7eb',
            borderRadius: '12px',
            padding: '30px',
            backgroundColor: '#f9fafb'
          }}>
            <h3 style={{ 
              fontSize: '24px', 
              fontWeight: 'bold', 
              marginBottom: '15px',
              color: '#1f2937'
            }}>
              ⚙️ Settings
            </h3>
            <p style={{ 
              color: '#6b7280', 
              marginBottom: '20px',
              lineHeight: '1.5'
            }}>
              Configure your preferences and API settings
            </p>
            <button 
              onClick={handleSettings}
              style={{
                padding: '12px 24px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              Configure
            </button>
          </div>
        </div>
        
        <div style={{
          backgroundColor: '#f0f9ff',
          border: '2px solid #0ea5e9',
          borderRadius: '12px',
          padding: '30px'
        }}>
          <h3 style={{ 
            fontSize: '28px', 
            fontWeight: 'bold', 
            marginBottom: '20px',
            color: '#0c4a6e'
          }}>
            🎯 Getting Started
          </h3>
          <div style={{
            color: '#6b7280',
            lineHeight: '1.8'
          }}>
            <p style={{ marginBottom: '15px' }}>
              Welcome to the LLM Interface! This is a powerful tool for creating 
              AI-powered workflows using a visual node-based editor.
            </p>
            <ul style={{
              listStyle: 'none',
              padding: 0
            }}>
              <li style={{ marginBottom: '10px' }}>
                ✅ Create workflow nodes for prompts, conditions, and responses
              </li>
              <li style={{ marginBottom: '10px' }}>
                🔗 Connect nodes to build complex AI chains
              </li>
              <li style={{ marginBottom: '10px' }}>
                🧪 Test your workflows with real AI models
              </li>
              <li style={{ marginBottom: '10px' }}>
                💾 Save and share your workflows with others
              </li>
            </ul>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div style={{
        borderTop: '2px solid #e5e7eb',
        paddingTop: '20px',
        marginTop: '50px',
        textAlign: 'center',
        color: '#6b7280'
      }}>
        <p style={{ margin: '0' }}>
          © 2025 LLM Interface. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default WorkflowDemo;