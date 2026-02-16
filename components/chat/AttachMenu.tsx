import { Dispatch, RefObject, SetStateAction } from 'react';

interface AttachMenuProps {
    show: boolean;
    setShow: Dispatch<SetStateAction<boolean>>;
    uploadingFile: boolean;
    fileInputRef: RefObject<HTMLInputElement>;
    imageInputRef: RefObject<HTMLInputElement>;
    videoInputRef: RefObject<HTMLInputElement>;
}

export default function AttachMenu({
    show,
    setShow,
    uploadingFile,
    fileInputRef,
    imageInputRef,
    videoInputRef
}: AttachMenuProps) {
    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setShow(!show)}
                className="w-10 h-10 bg-secondary text-secondary-foreground rounded-full flex items-center justify-center hover:bg-secondary/80 transition-colors"
                disabled={uploadingFile}
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
            </button>

            {show && (
                <div className="absolute bottom-full left-0 mb-2 bg-popover border border-border rounded-lg shadow-xl p-2 space-y-1 min-w-[160px]">
                    <button
                        type="button"
                        onClick={() => { imageInputRef.current?.click(); setShow(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent rounded text-sm"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>Gambar</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => { videoInputRef.current?.click(); setShow(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent rounded text-sm"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span>Video</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => { fileInputRef.current?.click(); setShow(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent rounded text-sm"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>File</span>
                    </button>
                </div>
            )}
        </div>
    );
}

