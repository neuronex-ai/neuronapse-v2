import { cn } from "@/lib/utils";
import React from "react";

interface FileIconProps {
    filename: string;
    className?: string;
    showLabel?: boolean; // Whether to show the extension label (e.g. "PDF")
}

const getFileExtension = (filename: string): string => {
    if (!filename.includes('.')) return '';
    return filename.split('.').pop()?.toLowerCase() || '';
};



// Base shape for file icons
const FileBase = ({ color, label, icon }: { color: string, label: string, icon?: React.ReactNode }) => {
    const displayLabel = label.length > 4 ? label.substring(0, 3) + ".." : label;

    return (
        <div className="relative w-full h-full aspect-[3/4]">
            <svg viewBox="0 0 60 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
                {/* Main body */}
                <path d="M5 0C2.23858 0 0 2.23858 0 5V75C0 77.7614 2.23858 80 5 80H55C57.7614 80 60 77.7614 60 75V20L40 0H5Z" fill={color} />
                {/* Folded corner */}
                <path d="M40 0V20H60L40 0Z" fill="white" fillOpacity="0.3" />
                <path d="M40 0L40 15C40 17.7614 42.2386 20 45 20H60" stroke="black" strokeOpacity="0.05" strokeWidth="1" fill="none" />
            </svg>

            {/* Center Icon */}
            <div className="absolute inset-0 flex items-center justify-center pb-4">
                {icon && <div className="w-1/2 h-1/2 text-white/90 drop-shadow-md">{icon}</div>}
            </div>

            {/* Extension Label */}
            <div className="absolute bottom-3 left-0 right-0 flex justify-center px-1">
                <span className="font-bold text-[9px] uppercase tracking-tighter text-white/95 bg-black/20 px-1.5 py-0.5 rounded-md backdrop-blur-[2px] border border-white/10 whitespace-nowrap overflow-hidden">
                    {displayLabel}
                </span>
            </div>
        </div>
    );
};


// Specific Icons
const PdfIcon = () => (
    <FileBase
        color="#FF5252"
        label="PDF"
        icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <path d="M14 2v6h6"></path>
                <path d="M16 13H8"></path>
                <path d="M16 17H8"></path>
                <path d="M10 9H8"></path>
            </svg>
        }
    />
);

const DocIcon = () => (
    <FileBase
        color="#448AFF"
        label="DOC"
        icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <line x1="10" y1="9" x2="8" y2="9" />
            </svg>
        }
    />
);

const XlsIcon = () => (
    <FileBase
        color="#00C853"
        label="XLS"
        icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M8 13h8" />
                <path d="M8 17h8" />
                <path d="M8 9h2" />
            </svg>
        }
    />
);

const ImageIcon = ({ ext }: { ext: string }) => (
    <FileBase
        color="#7C4DFF"
        label={ext.toUpperCase()}
        icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
            </svg>
        }
    />
);

const AudioIcon = ({ ext }: { ext: string }) => (
    <FileBase
        color="#FF4081"
        label={ext.toUpperCase()}
        icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
            </svg>
        }
    />
);

const VideoIcon = ({ ext }: { ext: string }) => (
    <FileBase
        color="#F44336"
        label={ext.toUpperCase()}
        icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                <line x1="7" y1="2" x2="7" y2="22" />
                <line x1="17" y1="2" x2="17" y2="22" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <line x1="2" y1="7" x2="7" y2="7" />
                <line x1="2" y1="17" x2="7" y2="17" />
                <line x1="17" y1="17" x2="22" y2="17" />
                <line x1="17" y1="7" x2="22" y2="7" />
            </svg>
        }
    />
);

const ZipIcon = ({ ext }: { ext: string }) => (
    <FileBase
        color="#FFAB00"
        label={ext.toUpperCase()}
        icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2v6h6" />
                <path d="M4 20h16a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4" />
                <path d="M2 13h4" />
                <path d="M4 13v7" />
            </svg>
        }
    />
);

const CodeIcon = ({ ext }: { ext: string }) => (
    <FileBase
        color="#263238"
        label={ext.toUpperCase()}
        icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
            </svg>
        }
    />
);

const GenericIcon = ({ ext }: { ext: string }) => (
    <FileBase
        color="#607D8B"
        label={ext.toUpperCase() || "FILE"}
        icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
            </svg>
        }
    />
);

export const PremiumFileIcon = ({ filename, className }: FileIconProps) => {
    const ext = getFileExtension(filename);

    const getIcon = () => {
        switch (ext) {
            case 'pdf':
                return <PdfIcon />;
            case 'doc':
            case 'docx':
            case 'txt':
            case 'rtf':
                return <DocIcon />;
            case 'xls':
            case 'xlsx':
            case 'csv':
                return <XlsIcon />;
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'gif':
            case 'webp':
            case 'svg':
                return <ImageIcon ext={ext} />;
            case 'mp3':
            case 'wav':
            case 'ogg':
                return <AudioIcon ext={ext} />;
            case 'mp4':
            case 'mov':
            case 'avi':
            case 'mkv':
                return <VideoIcon ext={ext} />;
            case 'zip':
            case 'rar':
            case '7z':
                return <ZipIcon ext={ext} />;
            case 'js':
            case 'ts':
            case 'tsx':
            case 'jsx':
            case 'html':
            case 'css':
            case 'json':
                return <CodeIcon ext={ext} />;
            default:
                return <GenericIcon ext={ext} />;
        }
    };

    return (
        <div className={cn(
            "relative transition-all duration-500 filter grayscale opacity-80 hover:grayscale-0 hover:opacity-100 hover:scale-110 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-110 ease-out origin-center",
            className
        )}>
            {getIcon()}
        </div>
    );
};
