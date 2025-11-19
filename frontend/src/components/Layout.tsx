import React, { ReactNode } from 'react'

interface LayoutProps {
  children?: ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#ffffff',
      padding: '20px'
    }}>
      {/* Header */}
      <header style={{
        borderBottom: '2px solid #e5e7eb',
        paddingBottom: '20px',
        marginBottom: '30px'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 20px'
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
      </header>
      
      {/* Main Content */}
      <main style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {children}
      </main>
      
      {/* Footer */}
      <footer style={{
        borderTop: '2px solid #e5e7eb',
        paddingTop: '20px',
        marginTop: '50px',
        textAlign: 'center',
        color: '#6b7280'
      }}>
        <p style={{ margin: '0' }}>
          © 2024 LLM Interface. All rights reserved.
        </p>
      </footer>
    </div>
  )
}

export default Layout