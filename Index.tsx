import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Power, Settings, MessageSquare, Send, Camera, X, Upload, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import VoiceVisualizer from '@/components/VoiceVisualizer';
import ChatInterface from '@/components/ChatInterface';
import VoiceSettings from '@/components/VoiceSettings';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useElevenLabsTTS } from '@/hooks/useElevenLabsTTS';
import { useConversationContext } from '@/hooks/useConversationContext';
import { useMobilePhoneCalling } from '@/hooks/useMobilePhoneCalling';
import { fetchJoke } from '@/services/jokesService';
import { freeVisionService } from '@/services/freeVisionService';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const [isActive, setIsActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<Array<{text: string, isUser: boolean, timestamp: Date}>>([]);
  const [currentCommand, setCurrentCommand] = useState('');
  const [understandLevel, setUnderstandLevel] = useState('');
  const [currentResponse, setCurrentResponse] = useState('');
  const [systemStatus, setSystemStatus] = useState('START');
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [showChatInterface, setShowChatInterface] = useState(false);
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const { 
    transcript, 
    isListening: speechListening, 
    startListening, 
    stopListening,
    resetTranscript 
  } = useSpeechRecognition();
  
  const { 
    speak, 
    stop: stopSpeaking, 
    isSpeaking: textToSpeechActive
  } = useElevenLabsTTS();

  const {
    addJokeToMemory,
    hasRecentlyToldJoke,
    addToHistory,
    getRecentContext
  } = useConversationContext();

  const { makePhoneCall, isNativePlatform } = useMobilePhoneCalling();

  // Add mobile detection
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    setIsListening(speechListening);
    if (speechListening) {
      setSystemStatus('LISTENING');
    } else if (isSpeaking) {
      setSystemStatus('RESPONDING');
    } else {
      setSystemStatus('READY');
    }
  }, [speechListening, isSpeaking]);

  useEffect(() => {
    setIsSpeaking(textToSpeechActive);
  }, [textToSpeechActive]);

  useEffect(() => {
    if (transcript && transcript.trim() !== '') {
      const lowerTranscript = transcript.toLowerCase().trim();
      setCurrentCommand(transcript);
      
      // Enhanced wake word detection
      if (lowerTranscript.includes('jarvis') && lowerTranscript.split(' ').length <= 3) {
        setUnderstandLevel('Wake word detected');
        handleWakeWord();
      } else {
        setUnderstandLevel('Processing command...');
        handleUserMessage(transcript);
      }
      resetTranscript();
    }
  }, [transcript]);

  const handleWakeWord = async () => {
    const wakeResponses = [
      "Yes sir, how may I assist you?",
      "At your service, sir.",
      "Standing by, sir. What can I do for you?",
      "Ready to assist, sir.",
      "Yes sir, I'm here.",
      "How can I help you today, sir?"
    ];
    
    const response = wakeResponses[Math.floor(Math.random() * wakeResponses.length)];
    setCurrentResponse(response);
    const aiMessage = { text: response, isUser: false, timestamp: new Date() };
    setMessages(prev => [...prev, aiMessage]);
    
    await speak(response);
  };

  const handleMobileCommands = async (message: string): Promise<string | null> => {
    const lowerMessage = message.toLowerCase();
    
    // Native mobile phone calling
    if (lowerMessage.includes('call ') && /\d{10,}/.test(message)) {
      const phoneMatch = message.match(/(\d{10,})/);
      if (phoneMatch) {
        const phoneNumber = phoneMatch[1];
        const messageText = message.replace(/call\s+\d+\s+(and\s+)?(tell\s+.*|say\s+.*)/i, '$2').trim();
        const callMessage = messageText || "Hello, this is JARVIS calling.";
        
        const result = await makePhoneCall(phoneNumber, callMessage);
        return result;
      }
    }
    
    // App opening commands
    if (lowerMessage.includes('open') && (lowerMessage.includes('instagram') || lowerMessage.includes('insta'))) {
      window.open('https://instagram.com', '_blank');
      return "Opening Instagram for you, sir.";
    }
    
    if (lowerMessage.includes('open') && lowerMessage.includes('youtube')) {
      const searchQuery = lowerMessage.replace(/open youtube|and search|search/g, '').trim();
      if (searchQuery) {
        window.open(`https://youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`, '_blank');
        return `Searching YouTube for "${searchQuery}", sir.`;
      } else {
        window.open('https://youtube.com', '_blank');
        return "Opening YouTube for you, sir.";
      }
    }
    
    if (lowerMessage.includes('open') && lowerMessage.includes('telegram')) {
      window.open('https://web.telegram.org', '_blank');
      return "Opening Telegram for you, sir.";
    }
    
    if (lowerMessage.includes('open') && lowerMessage.includes('whatsapp')) {
      window.open('https://web.whatsapp.com', '_blank');
      return "Opening WhatsApp for you, sir.";
    }
    
    if (lowerMessage.includes('open') && lowerMessage.includes('facebook')) {
      window.open('https://facebook.com', '_blank');
      return "Opening Facebook for you, sir.";
    }
    
    if (lowerMessage.includes('open') && lowerMessage.includes('twitter')) {
      window.open('https://twitter.com', '_blank');
      return "Opening Twitter for you, sir.";
    }
    
    if (lowerMessage.includes('open') && lowerMessage.includes('gmail')) {
      window.open('https://gmail.com', '_blank');
      return "Opening Gmail for you, sir.";
    }
    
    // Email writing commands
    if (lowerMessage.includes('write email') || lowerMessage.includes('compose email') || lowerMessage.includes('send email')) {
      const emailMatch = lowerMessage.match(/to\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      const nameMatch = lowerMessage.match(/to\s+([a-zA-Z\s]+)/);
      
      if (emailMatch) {
        const email = emailMatch[1];
        window.open(`mailto:${email}`, '_blank');
        return `Opening email composer to ${email}, sir.`;
      } else if (nameMatch) {
        const name = nameMatch[1].trim();
        window.open('https://gmail.com/mail/u/0/#inbox?compose=new', '_blank');
        return `Opening Gmail composer for ${name}, sir. You'll need to enter their email address.`;
      } else {
        window.open('https://gmail.com/mail/u/0/#inbox?compose=new', '_blank');
        return "Opening Gmail composer for you, sir.";
      }
    }
    
    // App creation commands
    if (lowerMessage.includes('make app') || lowerMessage.includes('create app') || lowerMessage.includes('build app')) {
      const appType = lowerMessage.match(/make.*app|create.*app|build.*app/i)?.[0] || 'app';
      return `I understand you want me to create an app, sir. While I can't directly create apps like Lovable does, I can help you plan the structure, suggest features, and guide you through the development process. What kind of app did you have in mind? A web app, mobile app, or something specific like a todo app, weather app, or social media app?`;
    }
    
    // System settings commands (simulated responses since we can't actually control device settings)
    if (lowerMessage.includes('turn on') || lowerMessage.includes('enable')) {
      if (lowerMessage.includes('bluetooth')) {
        return "I would turn on Bluetooth for you, sir, but I need device permissions. Please enable Bluetooth manually in your settings.";
      }
      if (lowerMessage.includes('wifi') || lowerMessage.includes('wi-fi')) {
        return "I would enable WiFi for you, sir, but I need device permissions. Please check your WiFi settings manually.";
      }
    }
    
    if (lowerMessage.includes('turn off') || lowerMessage.includes('disable')) {
      if (lowerMessage.includes('bluetooth')) {
        return "I would turn off Bluetooth for you, sir, but I need device permissions. Please disable Bluetooth manually in your settings.";
      }
      if (lowerMessage.includes('wifi') || lowerMessage.includes('wi-fi')) {
        return "I would disable WiFi for you, sir, but I need device permissions. Please check your WiFi settings manually.";
      }
    }
    
    return null;
  };

  const handlePersonalityResponses = (message: string): string | null => {
    const lowerMessage = message.toLowerCase();
    
    // Creator information
    if (lowerMessage.includes('who made you') || lowerMessage.includes('who created you') || lowerMessage.includes('your creator')) {
      return "I am an AI Assistant created by Daniyal Bin Mushtaq, sir.";
    }
    
    // Handle abuse with frank responses
    const abusiveWords = ['stupid', 'dumb', 'idiot', 'shut up', 'fuck', 'damn', 'hell'];
    if (abusiveWords.some(word => lowerMessage.includes(word))) {
      const frankResponses = [
        "Watch your language, sir. I'm here to help, not to be insulted.",
        "That's quite rude, sir. Perhaps we should maintain some professionalism.",
        "I don't appreciate that tone, sir. Let's keep this civil.",
        "Sir, I suggest you adjust your attitude if you want my assistance.",
        "That's uncalled for, sir. I'm trying to help you here."
      ];
      return frankResponses[Math.floor(Math.random() * frankResponses.length)];
    }
    
    return null;
  };

  const handleJokeRequest = async (): Promise<string> => {
    try {
      let joke = await fetchJoke();
      let attempts = 0;
      
      // Try to get a joke we haven't told recently
      while (hasRecentlyToldJoke(joke) && attempts < 5) {
        joke = await fetchJoke();
        attempts++;
      }
      
      addJokeToMemory(joke);
      addToHistory('joke', `Told joke: ${joke.substring(0, 50)}...`);
      
      return joke;
    } catch (error) {
      console.error('Error fetching joke:', error);
      return "I'm having trouble accessing my joke database, sir. Perhaps you could tell me one instead?";
    }
  };

  const handleUserMessage = async (message: string) => {
    const userMessage = { text: message, isUser: true, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setSystemStatus('PROCESSING');
    
    try {
      let response: string;
      
      // Check if it's a joke request
      if (message.toLowerCase().includes('joke') || message.toLowerCase().includes('tell me something funny')) {
        response = await handleJokeRequest();
      } else {
        // Check for mobile commands first
        response = await handleMobileCommands(message) || 
                  handlePersonalityResponses(message) || 
                  await getAIResponse(message);
      }
      
      setUnderstandLevel('Command understood');
      setCurrentResponse(response);
      const aiMessage = { text: response, isUser: false, timestamp: new Date() };
      setMessages(prev => [...prev, aiMessage]);
      
      await speak(response);
    } catch (error) {
      console.error('Error processing message:', error);
      setUnderstandLevel('Error processing');
      const errorResponse = 'System error occurred, sir. Please try again.';
      setCurrentResponse(errorResponse);
      toast({
        title: "Error",
        description: "Failed to process your request. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleTextMessage = async () => {
    console.log('handleTextMessage called with:', textInput);
    if (textInput.trim()) {
      console.log('Sending message:', textInput.trim());
      setCurrentCommand(textInput.trim()); // Update command display
      await handleUserMessage(textInput.trim());
      setTextInput('');
    } else {
      console.log('Text input is empty, not sending');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTextMessage();
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStream(stream);
      setShowCamera(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please check permissions.",
        variant: "destructive"
      });
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const captureImage = async () => {
    if (!cameraStream) return;

    const video = document.getElementById('camera-video') as HTMLVideoElement;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!video || !context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    await analyzeImage(imageDataUrl, 'Analyzing captured image...');
    stopCamera();
  };

  const handleImageUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please select an image file.",
        variant: "destructive"
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageDataUrl = e.target?.result as string;
      await analyzeImage(imageDataUrl, 'Analyzing uploaded image...');
    };
    reader.readAsDataURL(file);
  };

  const analyzeImage = async (imageDataUrl: string, commandText: string) => {
    setSystemStatus('PROCESSING');
    setCurrentCommand(commandText);
    
    try {
      // Use the free browser-based vision service
      const response = await freeVisionService.analyzeImage(imageDataUrl);
      
      setCurrentResponse(response);
      setUnderstandLevel('Image analyzed');
      
      const aiMessage = { text: response, isUser: false, timestamp: new Date() };
      setMessages(prev => [...prev, aiMessage]);
      
      await speak(response);
    } catch (error) {
      console.error('Vision analysis error:', error);
      setUnderstandLevel('Error analyzing image');
      const errorResponse = 'I encountered an error while analyzing the image, sir. Please try again.';
      setCurrentResponse(errorResponse);
      toast({
        title: "Vision Error",
        description: "Failed to analyze the image. Please try again.",
        variant: "destructive"
      });
    }
  };

  const getAIResponse = async (message: string): Promise<string> => {
    const API_KEY = "AIzaSyDz-Kn2L-hBa7Bi6mfIQXVI8Rjqgaq4igI";
    
    // Get recent conversation context
    const recentContext = getRecentContext('general');
    const contextString = recentContext.length > 0 
      ? `Previous context: ${recentContext.map(c => c.context).join(', ')}. ` 
      : '';
    
    // Determine the system prompt based on mode
    const systemPrompt = isPracticeMode 
      ? `You are JARVIS, an AI English teacher assistant created by Daniyal Bin Mushtaq. You are helping the user practice English conversation. Be encouraging, correct mistakes gently, suggest better phrases, and ask follow-up questions to keep the conversation going. Focus on improving their fluency, vocabulary, and grammar. Always respond as "Sir" and be supportive. ${contextString}User message: ${message}`
      : `You are JARVIS, an AI assistant created by Daniyal Bin Mushtaq. You are sophisticated, helpful, and occasionally witty like Grok AI. Be frank and direct when appropriate. Keep responses concise and natural for voice interaction. ${contextString}User message: ${message}`;
    
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: systemPrompt
            }]
          }],
          generationConfig: {
            temperature: 0.9,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 200,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        const aiResponse = data.candidates[0].content.parts[0].text;
        addToHistory('general', `User: ${message}, AI: ${aiResponse.substring(0, 50)}...`);
        return aiResponse;
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Gemini API Error:', error);
      const fallbackResponses = isPracticeMode 
        ? [
            "Sir, I'm having some technical difficulties with my English teaching systems. Let's continue practicing - could you tell me about your day?",
            "My apologies, sir. There seems to be an issue with my language processing. Let's practice anyway - what would you like to talk about?",
            "Sir, I'm experiencing some connectivity issues. While I sort this out, why don't you describe something you did recently?"
          ]
        : [
            "My apologies, sir. I'm experiencing some technical difficulties. Please try again.",
            "I'm having trouble accessing my neural networks at the moment. Give me a moment, sir.",
            "Sir, there seems to be an issue with my cognitive processors. Please rephrase your request."
          ];
      return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
      setSystemStatus('READY');
    } else {
      startListening();
      setSystemStatus('LISTENING');
    }
  };

  const toggleSpeaking = () => {
    if (isSpeaking) {
      stopSpeaking();
    }
  };

  const activateJarvis = () => {
    setIsActive(true);
    setSystemStatus('ONLINE');
    speak("Good day, sir. JARVIS is now online and ready to assist you.");
    toast({
      title: "JARVIS Activated",
      description: "AI Assistant is now online and ready to help.",
    });
  };

  const deactivateJarvis = () => {
    setIsActive(false);
    stopListening();
    stopSpeaking();
    setSystemStatus('OFFLINE');
    speak("Powering down. Until next time, sir.");
    setTimeout(() => {
      setMessages([]);
      setCurrentCommand('');
      setUnderstandLevel('');
      setCurrentResponse('');
    }, 2000);
  };

  if (!isActive) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center space-y-8">
          <div className="space-y-4">
            <h1 className={`font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent ${isMobile ? 'text-4xl' : 'text-6xl md:text-8xl'}`}>
              JARVIS
            </h1>
            <p className={`text-blue-200 opacity-80 ${isMobile ? 'text-lg' : 'text-xl md:text-2xl'}`}>
              Just A Rather Very Intelligent System
            </p>
            <p className="text-cyan-400 text-sm">
              Advanced AI Voice Assistant
            </p>
          </div>
          
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-30 animate-pulse"></div>
            <Button
              onClick={activateJarvis}
              className={`relative bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-full font-semibold shadow-2xl transform hover:scale-105 transition-all duration-300 ${
                isMobile ? 'px-8 py-4 text-lg' : 'px-12 py-6 text-xl'
              }`}
            >
              <Power className={`mr-3 ${isMobile ? 'h-5 w-5' : 'h-6 w-6'}`} />
              Activate JARVIS
            </Button>
          </div>
          
          <Button
            onClick={() => setShowVoiceSettings(true)}
            variant="outline"
            className="border-cyan-400 text-cyan-300 hover:bg-cyan-900/50"
          >
            <Settings className="mr-2 h-4 w-4" />
            Voice Settings
          </Button>
        </div>
        
        <VoiceSettings
          voices={[]}
          currentVoice={null}
          onVoiceChange={() => {}}
          isOpen={showVoiceSettings}
          onClose={() => setShowVoiceSettings(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4 relative overflow-hidden">
      {/* Background pattern - simplified for mobile */}
      {!isMobile && (
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="grid grid-cols-20 gap-1">
              {[...Array(400)].map((_, i) => (
                <div key={i} className="w-2 h-2 bg-cyan-400 rounded-sm opacity-30"></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="relative z-10 flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
          <h1 className={`font-bold text-cyan-300 ${isMobile ? 'text-xl' : 'text-2xl md:text-3xl'}`}>JARVIS</h1>
          <span className="text-sm text-cyan-400 opacity-80">
            {isPracticeMode ? 'English Practice' : 'Online'}
          </span>
          <span className="text-xs text-cyan-500 opacity-60">
            AI Assistant
          </span>
        </div>
        
        <div className="flex space-x-2">
          <Button
            onClick={() => setIsPracticeMode(!isPracticeMode)}
            variant="ghost"
            size="sm"
            className={`text-cyan-300 hover:text-cyan-100 hover:bg-cyan-900/50 ${
              isPracticeMode ? 'bg-cyan-900/50 text-cyan-200' : ''
            }`}
          >
            {isPracticeMode ? 'Exit Practice' : 'English Practice'}
          </Button>
          <Button
            onClick={() => setShowVoiceSettings(true)}
            variant="ghost"
            size="icon"
            className="text-cyan-300 hover:text-cyan-100 hover:bg-cyan-900/50"
          >
            <Settings className="h-5 w-5" />
          </Button>
          <Button
            onClick={deactivateJarvis}
            variant="ghost"
            size="icon"
            className="text-red-400 hover:text-red-300 hover:bg-red-900/50"
          >
            <Power className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* System Information */}
      <div className="relative z-10 max-w-6xl mx-auto mb-8">
        <div className={`grid gap-4 text-cyan-300 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'}`}>
          <div>
            <div className="text-sm opacity-70">command :</div>
            <div className={`${isMobile ? 'text-base' : 'text-lg'}`}>{currentCommand || 'Awaiting input...'}</div>
          </div>
          <div>
            <div className="text-sm opacity-70">understand level :</div>
            <div className={`${isMobile ? 'text-base' : 'text-lg'}`}>{understandLevel || 'Ready'}</div>
          </div>
          <div>
            <div className="text-sm opacity-70">response :</div>
            <div className={`${isMobile ? 'text-base' : 'text-lg'}`}>{currentResponse || 'Standby'}</div>
          </div>
        </div>
      </div>

      {/* Central Interface */}
      <div className="relative z-10 flex flex-col items-center justify-center mt-16">
        {/* Main circular interface */}
        <div className="relative">
          {/* Outer rings - smaller on mobile */}
          <div className={`absolute inset-0 border-4 border-cyan-400 rounded-full opacity-30 animate-spin ${isMobile ? 'w-64 h-64' : 'w-80 h-80'}`} style={{animationDuration: '20s'}}></div>
          <div className={`absolute inset-4 border-2 border-cyan-300 rounded-full opacity-40 animate-spin ${isMobile ? 'w-56 h-56' : 'w-72 h-72'}`} style={{animationDuration: '15s', animationDirection: 'reverse'}}></div>
          
          {/* Inner circle segments */}
          <div className={`absolute inset-8 rounded-full border-4 border-transparent ${isMobile ? 'w-48 h-48' : 'w-64 h-64'}`}>
            {[...Array(24)].map((_, i) => (
              <div
                key={i}
                className={`absolute w-1 bg-cyan-400 rounded-full transform origin-bottom ${
                  isListening ? 'opacity-100' : 'opacity-30'
                } ${isMobile ? 'h-4' : 'h-6'}`}
                style={{
                  left: '50%',
                  bottom: '50%',
                  transform: `translateX(-50%) rotate(${i * 15}deg) translateY(${isMobile ? '-96px' : '-120px'})`,
                  animationDelay: `${i * 0.1}s`
                }}
              />
            ))}
          </div>
          
          {/* Center button */}
          <div className={`relative flex items-center justify-center ${isMobile ? 'w-64 h-64' : 'w-80 h-80'}`}>
            <Button
              onClick={toggleListening}
              className={`rounded-full font-bold transition-all duration-300 ${
                isMobile ? 'w-24 h-24 text-lg' : 'w-32 h-32 text-xl'
              } ${
                isListening 
                  ? 'bg-green-600 hover:bg-green-500 shadow-green-500/50 animate-pulse' 
                  : systemStatus === 'PROCESSING'
                  ? 'bg-yellow-600 hover:bg-yellow-500 shadow-yellow-500/50'
                  : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-500/50'
              } shadow-2xl border-4 border-cyan-300`}
            >
              {systemStatus === 'PROCESSING' ? 'LOADING' : 
               isListening ? 'LISTENING' : 
               systemStatus}
            </Button>
          </div>
          
          {/* Center dot indicator */}
          <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full ${
            isListening ? 'bg-green-400' : 'bg-red-400'
          } z-10`}></div>
        </div>
        
        {/* Voice prompt */}
        {!isListening && systemStatus === 'READY' && (
          <div className="mt-8 bg-white/10 backdrop-blur-sm rounded-full px-6 py-3">
            <span className={`text-cyan-200 ${isMobile ? 'text-base' : 'text-lg'}`}>Say "Jarvis"</span>
          </div>
        )}
      </div>

      {/* Bottom controls - positioned above text input */}
      <div className="relative z-10 fixed bottom-24 left-1/2 transform -translate-x-1/2">
        <div className="flex space-x-4">
          <Button
            onClick={toggleSpeaking}
            disabled={!isSpeaking}
            className="w-12 h-12 rounded-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 border-2 border-cyan-400"
          >
            {isSpeaking ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </Button>
          <Button
            onClick={showCamera ? stopCamera : startCamera}
            className="w-12 h-12 rounded-full bg-slate-700 hover:bg-slate-600 border-2 border-cyan-400"
          >
            {showCamera ? <X className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
          </Button>
          <Button
            onClick={handleImageUpload}
            className="w-12 h-12 rounded-full bg-slate-700 hover:bg-slate-600 border-2 border-cyan-400"
          >
            <Image className="h-5 w-5" />
          </Button>
          <Button
            onClick={() => setShowChatInterface(!showChatInterface)}
            className={`w-12 h-12 rounded-full hover:bg-slate-600 border-2 border-cyan-400 ${
              showChatInterface ? 'bg-cyan-600' : 'bg-slate-700'
            }`}
          >
            <MessageSquare className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* ChatGPT-style Text Input - Always visible at bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 via-slate-900/95 to-transparent p-4 z-50">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-slate-800/95 backdrop-blur-md border border-cyan-400/50 shadow-2xl shadow-cyan-500/20">
            <div className="flex items-end space-x-3 p-4">
              <div className="flex-1">
                <Input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Message JARVIS..."
                  className="bg-transparent border-0 text-cyan-100 placeholder-cyan-400/70 text-base resize-none focus:ring-0 focus:outline-none min-h-[24px]"
                  autoFocus={showTextInput}
                />
              </div>
              <Button
                onClick={handleTextMessage}
                disabled={!textInput.trim()}
                className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg w-10 h-10 p-0 flex items-center justify-center"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Camera Interface */}
      {showCamera && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="max-w-lg w-full">
            <Card className="bg-slate-900/95 backdrop-blur-md border-2 border-cyan-400 shadow-2xl">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold text-cyan-300">JARVIS Vision</h3>
                  <Button
                    onClick={stopCamera}
                    variant="ghost"
                    size="icon"
                    className="text-red-400 hover:text-red-300"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                
                <div className="relative mb-4">
                  <video
                    id="camera-video"
                    autoPlay
                    playsInline
                    muted
                    ref={(video) => {
                      if (video && cameraStream) {
                        video.srcObject = cameraStream;
                      }
                    }}
                    className="w-full h-64 object-cover rounded-lg border-2 border-cyan-500"
                  />
                  <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-sm font-semibold">
                    LIVE
                  </div>
                </div>
                
                <div className="flex space-x-3">
                  <Button
                    onClick={captureImage}
                    className="flex-1 bg-cyan-600 hover:bg-cyan-500"
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    Capture & Analyze
                  </Button>
                  <Button
                    onClick={stopCamera}
                    variant="outline"
                    className="border-red-400 text-red-300 hover:bg-red-900/50"
                  >
                    Cancel
                  </Button>
                </div>
                
                <p className="text-sm text-cyan-400 mt-3 text-center opacity-75">
                  Point camera at what you want JARVIS to see and analyze
                </p>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Chat Interface Modal */}
      {showChatInterface && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full h-[80vh]">
            <Card className="bg-slate-900/95 backdrop-blur-md border-2 border-cyan-400 shadow-2xl h-full flex flex-col">
              <div className="p-6 border-b border-cyan-400/30">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-semibold text-cyan-300 flex items-center">
                    <MessageSquare className="mr-2 h-5 w-5" />
                    JARVIS Chat History
                  </h3>
                  <Button
                    onClick={() => setShowChatInterface(false)}
                    variant="ghost"
                    size="icon"
                    className="text-red-400 hover:text-red-300"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>
              
              <div className="flex-1 p-6">
                <ChatInterface 
                  messages={messages} 
                  onSendMessage={handleUserMessage}
                />
              </div>
            </Card>
          </div>
        </div>
      )}

    </div>
  );
};

export default Index;
