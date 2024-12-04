import { useState, useEffect } from 'react';

interface DownloadModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function DownloadModal({ isOpen, onClose }: DownloadModalProps) {
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // Detect iOS
        setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream);
    }, []);

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
                                            <li>Scroll down and tap "Add to Home Screen"</li>
                                            <li>Tap "Add" in the top right</li>
                                        </ol>
                                    </div>
                                ) : (
                                    <div className="text-sm text-gray-500">
                                        <p>Home screen installation is currently only supported on iOS devices.</p>
                                        <p className="mt-2">Support for other platforms is coming soon!</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="mt-5 sm:mt-6">
                        <button
                            type="button"
                            className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                            onClick={onClose}
                        >
                            Got it
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
} 