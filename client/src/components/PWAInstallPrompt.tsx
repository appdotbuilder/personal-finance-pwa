import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X, Download, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if PWA is already installed
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (window.navigator as any).standalone === true;
    
    if (isInStandaloneMode || isIOSStandalone) {
      setIsInstalled(true);
      return;
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent;
      // Prevent the mini-infobar from appearing on mobile
      promptEvent.preventDefault();
      
      // Save the event so it can be triggered later
      setDeferredPrompt(promptEvent);
      
      // Show custom install prompt after a delay
      setTimeout(() => {
        setIsVisible(true);
      }, 30000); // Show after 30 seconds
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsVisible(false);
      setDeferredPrompt(null);
      
      // Show success message
      console.log('MoneyWise has been installed successfully!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Handle install button click
  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }

    // Clear the saved prompt since it can only be used once
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  // Handle dismiss
  const handleDismiss = () => {
    setIsVisible(false);
    
    // Don't show again for this session
    sessionStorage.setItem('pwa-install-dismissed', 'true');
  };

  // Don't show if already installed, dismissed this session, or no prompt available
  if (isInstalled || !isVisible || !deferredPrompt) {
    return null;
  }

  // Check if dismissed in this session
  if (sessionStorage.getItem('pwa-install-dismissed')) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
      <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xl border-0">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold">Install MoneyWise</h3>
              <p className="text-xs opacity-90 mt-1">
                Add MoneyWise to your home screen for quick access and offline features!
              </p>
              <div className="flex space-x-2 mt-3">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleInstallClick}
                  className="text-xs"
                >
                  <Download className="w-3 h-3 mr-1" />
                  Install
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDismiss}
                  className="text-xs text-white hover:bg-white/20"
                >
                  Later
                </Button>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              className="flex-shrink-0 p-1 text-white hover:bg-white/20"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// iOS Safari specific install instructions
export function IOSInstallPrompt() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if device is iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isInStandaloneMode = (window.navigator as any).standalone === true;
    
    // Show only on iOS Safari and not already installed
    if (isIOS && !isInStandaloneMode && !sessionStorage.getItem('ios-install-dismissed')) {
      setTimeout(() => {
        setIsVisible(true);
      }, 45000); // Show after 45 seconds
    }
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
      <Card className="bg-gradient-to-r from-gray-800 to-gray-900 text-white shadow-xl border-0">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold">Install MoneyWise on iOS</h3>
              <div className="text-xs opacity-90 mt-2 space-y-1">
                <p>1. Tap the Share button in Safari</p>
                <p>2. Select "Add to Home Screen"</p>
                <p>3. Tap "Add" to install</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsVisible(false);
                  sessionStorage.setItem('ios-install-dismissed', 'true');
                }}
                className="text-xs text-white hover:bg-white/20 mt-3"
              >
                Got it
              </Button>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsVisible(false);
                sessionStorage.setItem('ios-install-dismissed', 'true');
              }}
              className="flex-shrink-0 p-1 text-white hover:bg-white/20"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}