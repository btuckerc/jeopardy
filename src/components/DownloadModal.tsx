import { useState, useEffect } from 'react';

interface DownloadModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function DownloadModal({ isOpen, onClose }: DownloadModalProps) {
    const [isIOS, setIsIOS] = useState(false);
    const [isAndroid, setIsAndroid] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstalling, setIsInstalling] = useState(false);

    useEffect(() => {
        // Detect iOS
        setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream);
        
        // Detect Android
        setIsAndroid(/Android/.test(navigator.userAgent));
        
        // Listen for beforeinstallprompt event (Android/Chrome)
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };
        
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        
        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        
        setIsInstalling(true);
        try {
            await deferredPrompt.prompt();
            const choiceResult = await deferredPrompt.userChoice;
            
            if (choiceResult.outcome === 'accepted') {
                // User accepted the install prompt
                setDeferredPrompt(null);
                onClose();
            }
        } catch (error) {
            console.error('Error during PWA install:', error);
        } finally {
            setIsInstalling(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50">
            {/* Dark overlay */}
            <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose} />

            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-sm sm:p-6">
                    {/* Close button */}
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 text-gray-400 hover:text-gray-500"
                    >
                        <span className="sr-only">Close</span>
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    <div>
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                            <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15M9 12l3 3m0 0l3-3m-3 3V2.25" />
                            </svg>
                        </div>
                        <div className="mt-3 text-center sm:mt-5">
                            <h3 className="text-base font-semibold leading-6 text-gray-900">
                                Add trivrdy to Home Screen
                            </h3>
                            <div className="mt-2">
                                {isIOS ? (
                                    <div className="space-y-4 text-sm text-gray-500">
                                        <p>To add trivrdy to your home screen:</p>
                                        <ol className="list-decimal text-left pl-5 space-y-2">
                                            <li>Tap the Share button <span className="inline-block w-6 h-6 align-middle">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                                </svg>
                                            </span>
                                            </li>
                                            <li>Scroll down and tap &quot;Add to Home Screen&quot;</li>
                                            <li>Tap &quot;Add&quot; in the top right</li>
                                        </ol>
                                    </div>
                                ) : deferredPrompt ? (
                                    <div className="space-y-4 text-sm text-gray-500">
                                        <p>Install trivrdy as an app for a better experience!</p>
                                        <p>Click the button below to add trivrdy to your home screen.</p>
                                    </div>
                                ) : isAndroid ? (
                                    <div className="text-sm text-gray-500">
                                        <p>To add trivrdy to your home screen:</p>
                                        <ol className="list-decimal text-left pl-5 space-y-2 mt-2">
                                            <li>Open the browser menu (three dots)</li>
                                            <li>Tap &quot;Add to Home screen&quot; or &quot;Install app&quot;</li>
                                            <li>Confirm the installation</li>
                                        </ol>
                                    </div>
                                ) : (
                                    <div className="text-sm text-gray-500">
                                        <p>PWA installation is supported on iOS and Android devices.</p>
                                        <p className="mt-2">On desktop, you can use your browser&apos;s install option from the address bar.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="mt-5 sm:mt-6 space-y-3">
                        {deferredPrompt && (
                            <button
                                type="button"
                                disabled={isInstalling}
                                className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={handleInstallClick}
                            >
                                {isInstalling ? (
                                    <>
                                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent mr-2"></span>
                                        Installing...
                                    </>
                                ) : (
                                    'Install App'
                                )}
                            </button>
                        )}
                        <button
                            type="button"
                            className="inline-flex w-full justify-center rounded-md bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500"
                            onClick={onClose}
                        >
                            {deferredPrompt ? 'Maybe Later' : 'Got it'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
} 