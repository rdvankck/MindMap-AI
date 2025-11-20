import React, { useState, useRef, useEffect } from 'react';

interface ConversationNode {
  id: string;
  x: number;
  y: number;
  text: string;
  type: 'question' | 'answer' | 'branch';
  children: string[];
  parent: string | null;
  expanded: boolean;
  level: number;
}

interface Connection {
  from: string;
  to: string;
  fromPosition: { x: number; y: number };
  toPosition: { x: number; y: number };
}

const VisualThinkingMap: React.FC = () => {
  const [nodes, setNodes] = useState<ConversationNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [isAddingNode, setIsAddingNode] = useState(false);
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null);
  const [nodeInput, setNodeInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showInputModal, setShowInputModal] = useState(false);
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [isAddingQuestion, setIsAddingQuestion] = useState<string | null>(null);
  const [questionClickPosition, setQuestionClickPosition] = useState<{ x: number; y: number } | null>(null);
  const [questionInput, setQuestionInput] = useState('');
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [isExpanding, setIsExpanding] = useState<string | null>(null);
  const [expandClickPosition, setExpandClickPosition] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Initialize with a starting node
  useEffect(() => {
    const startNode: ConversationNode = {
      id: 'start',
      x: 400,
      y: 250,
      text: 'Type your question here and click expand to get AI response...',
      type: 'question',
      children: [],
      parent: null,
      expanded: false,
      level: 0
    };
    console.log('Creating start node:', startNode);
    setNodes([startNode]);
  }, []);

  // Update connections when nodes change
  useEffect(() => {
    const newConnections: Connection[] = [];
    nodes.forEach(node => {
      if (node.parent) {
        const parentNode = nodes.find(n => n.id === node.parent);
        if (parentNode) {
          newConnections.push({
            from: node.parent,
            to: node.id,
            fromPosition: { x: parentNode.x, y: parentNode.y },
            toPosition: { x: node.x, y: node.y }
          });
        }
      }
    });
    setConnections(newConnections);
  }, [nodes]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      if (isAddingNode) {
        setClickPosition({ x, y });
        setShowInputModal(true);
      } else if (isAddingQuestion && questionInput.trim()) {
        // Create both question and answer at the clicked position
        createQuestionAndAnswer(x, y);
      } else if (isExpanding) {
        setExpandClickPosition({ x, y });
        // Process the expansion immediately
        processExpansion(isExpanding, x, y);
        setIsExpanding(null);
      }
    }
  };

  const handleNodeClick = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAddingNode && !isDragging) {
      setSelectedNode(nodeId === selectedNode ? null : nodeId);
    }
  };

  const handleNodeMouseDown = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        setDragOffset({
          x: mouseX - node.x,
          y: mouseY - node.y
        });
        setIsDragging(nodeId);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const newX = e.clientX - rect.left - dragOffset.x;
        const newY = e.clientY - rect.top - dragOffset.y;
        
        setNodes(prev => prev.map(node => 
          node.id === isDragging 
            ? { ...node, x: newX, y: newY }
            : node
        ));
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(null);
  };

  const handleNodeExpand = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    // Start expansion mode instead of immediate expansion
    setIsExpanding(nodeId);
    setSelectedNode(null);
  };

  const handleAddQuestion = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    // Open question modal directly
    setIsAddingQuestion(nodeId);
    setShowQuestionModal(true);
    setSelectedNode(null);
  };

  const createQuestionAndAnswer = async (x: number, y: number) => {
    if (!questionInput.trim() || !isAddingQuestion) return;

    // Create placeholder nodes immediately
    const questionNodeId = `question-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const answerNodeId = `answer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create question node (positioned exactly where user clicked)
    const questionNode: ConversationNode = {
      id: questionNodeId,
      x: x,
      y: y,
      text: questionInput.trim(),
      type: 'question',
      children: [answerNodeId],
      parent: isAddingQuestion,
      expanded: true,
      level: 0
    };

    // Create placeholder answer node (positioned below the question)
    // Since answer nodes are 400px wide (vs 200px for questions), we need to adjust the x position
    // to align with the question's center
    const answerNode: ConversationNode = {
      id: answerNodeId,
      x: x, // Same x position as question (they'll be centered differently due to width)
      y: y + 180, // Position below the question
      text: '🤔 AI cevabı alınıyor...',
      type: 'answer',
      children: [],
      parent: questionNodeId,
      expanded: false,
      level: 1
    };

    // Add both nodes to state immediately
    setNodes(prev => [...prev, questionNode, answerNode]);

    // Add question to original parent
    setNodes(prev => prev.map(n => 
      n.id === isAddingQuestion ? { ...n, children: [...(n.children || []), questionNodeId] } : n
    ));

    setIsProcessing(true);

    // Build context for this question
    const context = buildConversationContext(isAddingQuestion);

    try {
      // Get AI response
      const response = await fetch('http://localhost:3002/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: questionInput.trim(),
          model: 'deepseek-coder:latest',
          context: context
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update answer node with real AI response
        setNodes(prev => prev.map(n => 
          n.id === answerNodeId ? { ...n, text: data.response } : n
        ));
      }
    } catch (error) {
      console.error('Error getting AI response:', error);
      // Update answer node with error message
      setNodes(prev => prev.map(n => 
        n.id === answerNodeId ? { ...n, text: '❌ Cevap alınamadı. Lütfen tekrar deneyin.' } : n
      ));
    } finally {
      // Reset states
      setQuestionInput('');
      setQuestionClickPosition(null);
      setIsAddingQuestion(null);
      setIsProcessing(false);
    }
  };

  const buildConversationContext = (nodeId: string): string => {
    const context: string[] = [];
    const mainPath: string[] = [];
    
    // Ana konuşma yolunu bul (root'ten bu node'a kadar)
    const buildMainPath = (currentNodeId: string): void => {
      const node = nodes.find(n => n.id === currentNodeId);
      if (!node) return;
      
      // Parent varsa önce parent'ı işle
      if (node.parent) {
        buildMainPath(node.parent);
      }
      
      // Bu node'u context'e ekle
      if (node.type === 'question') {
        mainPath.push(`Kullanıcı: ${node.text}`);
      } else if (node.type === 'answer') {
        mainPath.push(`Asistan: ${node.text}`);
      }
    };
    
    // İlgili kardeş soruları ve cevapları bul (aynı parent'a sahip olanlar)
    // AMA SADECE ana düğüm DEĞİLSE - yani yan dallardaysa ilgili diğer dalları göster
    const findRelatedConversations = (nodeId: string): void => {
      const currentNode = nodes.find(n => n.id === nodeId);
      if (!currentNode || !currentNode.parent) return;
      
      // Eğer parent ana başlangıç düğümü ise, yan dalları gösterme
      if (currentNode.parent === 'start') {
        console.log('Parent is start node, skipping related conversations');
        return;
      }
      
      const parentNode = nodes.find(n => n.id === currentNode.parent);
      if (!parentNode) return;
      
      // Parent'ın tüm çocuklarını bul (kardeşler)
      const siblings = nodes.filter(n => 
        n.parent === currentNode.parent && 
        n.id !== currentNode.id
      );
      
      if (siblings.length > 0) {
        context.push('\n--- İlgili Önceki Sorular ---');
        siblings.forEach(sibling => {
          if (sibling.type === 'question') {
            // Kardeş sorunun cevabını da bul
            const siblingAnswer = nodes.find(n => 
              sibling.children.includes(n.id) && n.type === 'answer'
            );
            if (siblingAnswer) {
              context.push(`Soru: ${sibling.text}`);
              context.push(`Cevap: ${siblingAnswer.text}`);
            }
          }
        });
        context.push('--- Devam Edilen Konu ---');
      }
    };
    
    console.log('Building enhanced context for node:', nodeId);
    
    // İlgili kardeş konuşmaları ekle (ancak ana düğümde değilse)
    findRelatedConversations(nodeId);
    
    // Ana konuşma yolunu ekle
    buildMainPath(nodeId);
    
    // Ana yolu context'e ekle
    mainPath.forEach(item => context.push(item));
    
    const finalContext = context.join('\n');
    console.log('Enhanced context:', finalContext);
    return finalContext;
  };

  const expandWithAIResponse = async (nodeId: string, questionText: string) => {
    setIsProcessing(true);
    
    try {
      // Build conversation context
      const context = buildConversationContext(nodeId);
      console.log('Context for node:', nodeId, context);
      
      const response = await fetch('http://localhost:3002/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: questionText,
          model: 'deepseek-coder:latest',
          context: context // Send conversation context to backend
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Find the question node to get its position
        const questionNode = nodes.find(n => n.id === nodeId);
        if (questionNode) {
          // Create answer node below the question
          const answerNode: ConversationNode = {
            id: `answer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            x: questionNode.x,
            y: questionNode.y + 180, // Position below the question
            text: data.response,
            type: 'answer',
            children: [],
            parent: nodeId,
            expanded: false,
            level: questionNode.level + 1
          };

          setNodes(prev => [...prev, answerNode]);
          
          // Update question node with the answer child
          setNodes(prev => prev.map(n => 
            n.id === nodeId ? { ...n, children: [answerNode.id], expanded: true } : n
          ));
        }
      }
    } catch (error) {
      console.error('Error getting AI response:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const processExpansion = async (nodeId: string, x: number, y: number) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setIsProcessing(true);
    
    try {
      // Build conversation context for this node
      const context = buildConversationContext(nodeId);
      
      const response = await fetch('http://localhost:3002/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: node.text,
          model: 'deepseek-coder:latest',
          context: context
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Create answer node at the clicked position (below where user clicked)
        // Position it exactly where the user clicked (x position will be centered based on node width)
        const answerNode: ConversationNode = {
          id: `answer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          x: x, // Use the exact clicked x position
          y: y + 180, // Position below the clicked position
          text: data.response,
          type: 'answer',
          children: [],
          parent: nodeId,
          expanded: false,
          level: node.level + 1
        };

        setNodes(prev => [...prev, answerNode]);
        
        // Add to parent node's children but don't mark as expanded (allow multiple expansions)
        setNodes(prev => prev.map(n => 
          n.id === nodeId ? { ...n, children: [...(n.children || []), answerNode.id] } : n
        ));
      }
    } catch (error) {
      console.error('Error expanding node:', error);
    } finally {
      setIsProcessing(false);
      setExpandClickPosition(null);
    }
  };

  const addNewNode = () => {
    if (!clickPosition || !nodeInput.trim()) return;

    const newNode: ConversationNode = {
      id: `node-${Date.now()}`,
      x: clickPosition.x,
      y: clickPosition.y,
      text: nodeInput,
      type: 'question',
      children: [],
      parent: null,
      expanded: false,
      level: 0
    };

    setNodes(prev => [...prev, newNode]);
    setShowInputModal(false);
    setNodeInput('');
    setClickPosition(null);
  };

  const deleteNode = (nodeId: string) => {
    // Find all children and grandchildren recursively
    const getAllDescendants = (id: string): string[] => {
      const node = nodes.find(n => n.id === id);
      if (!node) return [];
      
      let descendants = node.children || [];
      node.children.forEach(childId => {
        descendants = [...descendants, ...getAllDescendants(childId)];
      });
      return descendants;
    };

    const toDelete = [nodeId, ...getAllDescendants(nodeId)];
    
    setNodes(prev => prev.filter(n => !toDelete.includes(n.id)));
    setSelectedNode(null);
  };

  const startEditNode = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setEditingNode(nodeId);
      setEditText(node.text);
      setShowEditModal(true);
    }
  };

  const saveEditedNode = () => {
    if (editingNode && editText.trim()) {
      setNodes(prev => prev.map(n => 
        n.id === editingNode ? { ...n, text: editText.trim() } : n
      ));
    }
    setShowEditModal(false);
    setEditingNode(null);
    setEditText('');
  };

  const getNodeStyle = (node: ConversationNode) => {
    const isNodeDragging = isDragging === node.id;
    const isAnswerNode = node.type === 'answer';
    
    const baseStyle = {
      position: 'absolute' as const,
      left: `${node.x}px`,
      top: `${node.y}px`,
      transform: `translate(-50%, -50%) ${isNodeDragging ? 'scale(1.02)' : 'scale(1)'} ${selectedNode === node.id ? 'scale(1.02)' : 'scale(1)'}`,
      width: isAnswerNode ? '400px' : '200px',
      minHeight: isAnswerNode ? '150px' : (selectedNode === node.id ? '160px' : '80px'),
      maxHeight: isAnswerNode ? '300px' : 'none',
      borderRadius: isAnswerNode ? '18px' : '20px',
      padding: isAnswerNode ? '20px' : '15px',
      paddingBottom: selectedNode === node.id ? '80px' : (isAnswerNode ? '20px' : '15px'),
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: isAnswerNode ? 'flex-start' : 'center',
      justifyContent: isAnswerNode ? 'flex-start' : 'center',
      cursor: isNodeDragging ? 'grabbing' : 'grab',
      transition: isNodeDragging ? 'none' : 'all 0.3s ease',
      boxShadow: isNodeDragging ? '0 10px 30px rgba(0,0,0,0.3)' : 
                 selectedNode === node.id ? '0 6px 20px rgba(0,0,0,0.2)' : 
                 isAnswerNode ? '0 4px 20px rgba(76, 175, 80, 0.15)' : '0 4px 15px rgba(0,0,0,0.1)',
      border: selectedNode === node.id ? '3px solid #2196f3' : 
             isNodeDragging ? '3px solid #9333ea' : 
             isAnswerNode ? '2px solid #4caf50' : '2px solid #e0e0e0',
      backgroundColor: node.type === 'question' ? '#fff3e0' : 
                     node.type === 'answer' ? '#ffffff' : '#f3e5f5',
      textAlign: isAnswerNode ? 'left' as const : 'center' as const,
      fontSize: isAnswerNode ? '16px' : '14px',
      fontWeight: isAnswerNode ? '400' : '500',
      color: '#333',
      overflowY: isAnswerNode ? 'auto' as const : 'hidden' as const,
      wordWrap: 'break-word' as const,
      lineHeight: isAnswerNode ? '1.6' : '1.4',
      opacity: isNodeDragging ? 0.9 : 1,
      zIndex: isNodeDragging ? 1000 : (selectedNode === node.id ? 10 : 2),
      userSelect: isAnswerNode ? 'text' as const : 'none' as const
    };

    return baseStyle;
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'question': return '❓';
      case 'answer': return '💡';
      case 'branch': return '🔀';
      default: return '📍';
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#f5f7fa', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        height: '60px',
        backgroundColor: 'white',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
      }}>
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
            ← Geri
          </button>
          <h2 style={{ margin: 0, color: '#333' }}>🧠 Görsel Düşünce Haritası</h2>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', paddingRight: '20px' }}>
          <button
            onClick={() => {
              setIsAddingNode(!isAddingNode);
              setSelectedNode(null);
            }}
            style={{
              padding: '10px 20px',
              backgroundColor: isAddingNode ? '#4caf50' : '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: '25px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {isAddingNode ? '📍 Konum Seç' : '➕ Yeni Konu'}
          </button>
          
          {isAddingNode && (
            <div style={{
              padding: '8px 16px',
              backgroundColor: '#ff9800',
              color: 'white',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '500'
            }}>
              🗺️ Haritaya tıklayın
            </div>
          )}
          
          {isExpanding && (
            <div style={{
              padding: '8px 16px',
              backgroundColor: '#4caf50',
              color: 'white',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '500'
            }}>
              🎯 Genişletme için haritaya tıklayın
            </div>
          )}
          
          {isAddingQuestion && questionInput.trim() && (
            <div style={{
              padding: '8px 16px',
              backgroundColor: '#4caf50',
              color: 'white',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '500'
            }}>
              📍 Haritada konum seçin (soru ve cevap)
            </div>
          )}
          
          {isDragging && (
            <div style={{
              padding: '8px 16px',
              backgroundColor: '#9333ea',
              color: 'white',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '500'
            }}>
              ✋ Sürükleme modu
            </div>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          position: 'relative',
          width: '100%',
          height: 'calc(100vh - 60px)',
          minHeight: '600px',
          overflow: 'auto',
          cursor: isAddingNode || isAddingQuestion ? 'crosshair' : isDragging ? 'grabbing' : 'default',
          backgroundColor: '#fafbfc',
          backgroundImage: 'radial-gradient(circle, #e0e0e0 1px, transparent 1px)',
          backgroundSize: '30px 30px',
          backgroundPosition: '0 0, 0 0'
        }}
      >
        {/* SVG for connections */}
        <svg
          ref={svgRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 1
          }}
        >
          {connections.map((conn, index) => (
            <g key={index}>
              <defs>
                <marker
                  id={`arrowhead-${index}`}
                  markerWidth="10"
                  markerHeight="10"
                  refX="8"
                  refY="3"
                  orient="auto"
                >
                  <polygon
                    points="0 0, 10 3, 0 6"
                    fill="#666"
                  />
                </marker>
              </defs>
              <line
                x1={conn.fromPosition.x}
                y1={conn.fromPosition.y}
                x2={conn.toPosition.x}
                y2={conn.toPosition.y}
                stroke="#666"
                strokeWidth="2"
                markerEnd={`url(#arrowhead-${index})`}
                opacity="0.6"
              />
            </g>
          ))}
        </svg>

        {/* Nodes */}
        {console.log('Rendering nodes:', nodes) || nodes.map((node) => (
          <div
            key={node.id}
            style={getNodeStyle(node)}
            onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
            onClick={(e) => handleNodeClick(node.id, e)}
          >
            {node.type === 'answer' ? (
              <>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '12px',
                  paddingBottom: '8px',
                  borderBottom: '1px solid #e0e0e0'
                }}>
                  <span style={{ fontSize: '18px', marginRight: '8px' }}>🤖</span>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#4caf50'
                  }}>
                    AI Assistant
                  </span>
                </div>
                <div style={{ 
                  fontSize: '16px',
                  lineHeight: '1.6',
                  color: '#333',
                  whiteSpace: 'pre-wrap'
                }}>
                  {node.text}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>
                  {getNodeIcon(node.type)}
                </div>
                <div style={{ lineHeight: '1.4', maxHeight: '60px', overflowY: 'auto' }}>
                  {node.text}
                </div>
              </>
            )}
            
            {selectedNode === node.id && (
              <div style={{
                position: 'absolute',
                bottom: '5px',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: '5px',
                backgroundColor: 'white',
                padding: '5px',
                borderRadius: '15px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                zIndex: 100
              }}>
                {node.type === 'question' ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNodeExpand(node.id);
                    }}
                    disabled={isProcessing}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: isProcessing ? '#ccc' : '#4caf50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                      fontSize: '10px',
                      fontWeight: '500'
                    }}
                  >
                    {isProcessing ? '⏳' : '🚀'} Genişlet
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddQuestion(node.id);
                    }}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#2196f3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontSize: '10px',
                      fontWeight: '500'
                    }}
                  >
                    ➕ Soru Ekle
                  </button>
                )}
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditNode(node.id);
                  }}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#2196f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '10px',
                    fontWeight: '500'
                  }}
                >
                  ✏️ Soru Yaz
                </button>
                
                {node.id !== 'start' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNode(node.id);
                    }}
                    style={{
                      padding: '4px 6px',
                      backgroundColor: '#f44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontSize: '10px',
                      fontWeight: '500'
                    }}
                  >
                    🗑️ Sil
                  </button>
                )}
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNode(null);
                  }}
                  style={{
                    padding: '4px 6px',
                    backgroundColor: '#9e9e9e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '10px',
                    fontWeight: '500'
                  }}
                >
                  ❌
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Click position indicators */}
        {clickPosition && (
          <div
            style={{
              position: 'absolute',
              left: `${clickPosition.x}px`,
              top: `${clickPosition.y}px`,
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              backgroundColor: '#ff9800',
              border: '3px solid white',
              transform: 'translate(-50%, -50%)',
              zIndex: 1000,
              animation: 'pulse 1s infinite'
            }}
          />
        )}
        
        {expandClickPosition && (
          <div
            style={{
              position: 'absolute',
              left: `${expandClickPosition.x}px`,
              top: `${expandClickPosition.y}px`,
              width: '35px',
              height: '35px',
              borderRadius: '50%',
              backgroundColor: '#4caf50',
              border: '4px solid white',
              transform: 'translate(-50%, -50%)',
              zIndex: 1000,
              animation: 'pulse 1s infinite',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            🎯
          </div>
        )}
        
        {questionClickPosition && (
          <div
            style={{
              position: 'absolute',
              left: `${questionClickPosition.x}px`,
              top: `${questionClickPosition.y}px`,
              width: '35px',
              height: '35px',
              borderRadius: '50%',
              backgroundColor: '#2196f3',
              border: '4px solid white',
              transform: 'translate(-50%, -50%)',
              zIndex: 1000,
              animation: 'pulse 1s infinite',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            💬
          </div>
        )}
      </div>

      {/* Input Modal */}
      {showInputModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.3)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '15px',
            width: '400px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ marginTop: 0, color: '#333' }}>💭 Yeni Konu Ekle</h3>
            <textarea
              value={nodeInput}
              onChange={(e) => setNodeInput(e.target.value)}
              placeholder="Ne hakkında düşünmek istiyorsunuz?"
              style={{
                width: '100%',
                height: '100px',
                padding: '12px',
                border: '2px solid #ddd',
                borderRadius: '8px',
                fontSize: '16px',
                resize: 'none',
                marginBottom: '20px'
              }}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowInputModal(false);
                  setNodeInput('');
                  setClickPosition(null);
                  setIsAddingNode(false);
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
                İptal
              </button>
              <button
                onClick={addNewNode}
                disabled={!nodeInput.trim()}
                style={{
                  padding: '10px 20px',
                  backgroundColor: !nodeInput.trim() ? '#ccc' : '#4caf50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: !nodeInput.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                Ekle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Question Modal */}
      {showQuestionModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.3)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '15px',
            width: '400px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ marginTop: 0, color: '#333' }}>💬 Yeni Soru Ekle</h3>
            <textarea
              value={questionInput}
              onChange={(e) => setQuestionInput(e.target.value)}
              placeholder="Yeni sorunuzu yazın..."
              style={{
                width: '100%',
                height: '100px',
                padding: '12px',
                border: '2px solid #ddd',
                borderRadius: '8px',
                fontSize: '16px',
                resize: 'none',
                marginBottom: '20px'
              }}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowQuestionModal(false);
                  setQuestionInput('');
                  setQuestionClickPosition(null);
                  setIsAddingQuestion(null);
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
                İptal
              </button>
              <button
                onClick={() => {
                  if (!questionInput.trim()) return;
                  setShowQuestionModal(false);
                  // We'll get AI response when user clicks on canvas
                }}
                disabled={!questionInput.trim()}
                style={{
                  padding: '10px 20px',
                  backgroundColor: !questionInput.trim() ? '#ccc' : '#4caf50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: !questionInput.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                📍 Konum Seç
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.3)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '15px',
            width: '400px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ marginTop: 0, color: '#333' }}>✏️ Sorunuzu Yazın</h3>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              placeholder="Örnek: Kek nasıl yapılır?"
              style={{
                width: '100%',
                height: '100px',
                padding: '12px',
                border: '2px solid #ddd',
                borderRadius: '8px',
                fontSize: '16px',
                resize: 'none',
                marginBottom: '20px'
              }}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingNode(null);
                  setEditText('');
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
                İptal
              </button>
              <button
                onClick={saveEditedNode}
                disabled={!editText.trim()}
                style={{
                  padding: '10px 20px',
                  backgroundColor: !editText.trim() ? '#ccc' : '#2196f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: !editText.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes pulse {
            0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
            50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.7; }
            100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          }
        `
      }} />
    </div>
  );
};

export default VisualThinkingMap;