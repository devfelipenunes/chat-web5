"use client";

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'generate' | 'scan';
  data?: string;
  onScanResult?: (result: string) => void;
  title?: string;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({ 
  isOpen, 
  onClose, 
  mode, 
  data, 
  onScanResult, 
  title 
}) => {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [manualInput, setManualInput] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === 'generate' && data && isOpen) {
      QRCode.toDataURL(data, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
      .then(url => setQrDataUrl(url))
      .catch(err => console.error('Erro ao gerar QR Code:', err));
    }
  }, [mode, data, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      stopScanning();
      setManualInput('');
      setScanError('');
    }
  }, [isOpen]);

  const initializeScanner = async () => {
    try {
      setScanError('');
      
      if (!videoRef.current) {
        throw new Error('Elemento de vídeo não encontrado');
      }
      
      const constraints = {
        video: { 
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 }
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      
      await videoRef.current.play();
      setIsScanning(true);
      
    } catch (error) {
      console.error('Erro ao inicializar câmera:', error);
      
      let errorMessage = 'Erro ao acessar câmera.';
      
      if (error instanceof Error) {
        if (error.message.includes('Permission denied') || error.message.includes('NotAllowedError')) {
          errorMessage = 'Permissão negada. Permita acesso à câmera e recarregue.';
        } else if (error.message.includes('NotFoundError')) {
          errorMessage = 'Nenhuma câmera encontrada neste dispositivo.';
        } else if (error.message.includes('NotSupportedError')) {
          errorMessage = 'Câmera não suportada neste navegador.';
        }
      }
      
      setScanError(errorMessage);
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    try {
      setIsScanning(false);
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    } catch (error) {
      console.warn('Erro ao parar scanner:', error);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    alert('Funcionalidade de scan de imagem em desenvolvimento. Use o input manual por enquanto.');
  };

  const handleManualSubmit = () => {
    if (manualInput.trim()) {
      onScanResult?.(manualInput.trim());
      onClose();
      setManualInput('');
    }
  };

  const copyToClipboard = async () => {
    if (data) {
      try {
        await navigator.clipboard.writeText(data);
        alert('Copiado para área de transferência!');
      } catch (error) {
        console.error('Erro ao copiar:', error);
        alert('Erro ao copiar. Use Ctrl+C manualmente.');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">
            {title || (mode === 'generate' ? 'Gerar QR Code' : 'Escanear QR Code')}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="p-4">
          {mode === 'generate' && (
            <div className="text-center space-y-4">
              {qrDataUrl && (
                <div className="flex flex-col items-center space-y-4">
                  <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                    <img
                      src={qrDataUrl}
                      alt="QR Code"
                      className="w-64 h-64 object-contain"
                    />
                  </div>
                  
                  <div className="text-sm text-gray-600 break-all bg-gray-50 p-2 rounded">
                    {data}
                  </div>
                  
                  <button
                    onClick={copyToClipboard}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  >
                    📋 Copiar Dados
                  </button>
                </div>
              )}
            </div>
          )}

          {mode === 'scan' && (
            <div className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">📱 Scanner por Câmera</h4>
                
                {scanError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {scanError}
                  </div>
                )}

                <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    playsInline
                    muted
                  />
                  
                  {!isScanning && !scanError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-80">
                      <button
                        onClick={initializeScanner}
                        className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        📷 Iniciar Câmera
                      </button>
                    </div>
                  )}
                  
                  {isScanning && (
                    <div className="absolute inset-0 border-4 border-green-400 rounded-lg pointer-events-none">
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-green-400 rounded-lg"></div>
                    </div>
                  )}
                </div>

                {isScanning && (
                  <div className="flex justify-center space-x-2">
                    <button
                      onClick={stopScanning}
                      className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                    >
                      ⏹️ Parar
                    </button>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h4 className="font-medium text-gray-900 mb-3">📸 Upload de Imagem</h4>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                >
                  📁 Selecionar Imagem
                </button>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h4 className="font-medium text-gray-900 mb-3">⌨️ Inserir Manualmente</h4>
                <div className="space-y-3">
                  <textarea
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="Cole ou digite o conteúdo do QR Code aqui..."
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    rows={3}
                  />
                  <button
                    onClick={handleManualSubmit}
                    disabled={!manualInput.trim()}
                    className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    ✅ Confirmar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QRCodeModal;
