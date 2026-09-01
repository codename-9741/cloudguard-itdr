import React, { useState } from 'react';
import { X, Copy, Check, FileCode } from 'lucide-react';
import { CloudTrailEvent } from '../types';

interface RawJsonModalProps {
  event: CloudTrailEvent | null;
  onClose: () => void;
}

export const RawJsonModal: React.FC<RawJsonModalProps> = ({ event, onClose }) => {
  if (!event) return null;

  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(event, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs font-sans">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded border border-gray-800 bg-[#0F1219] shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3 bg-[#161B22]">
          <div className="flex items-center gap-2">
            <FileCode className="h-4 w-4 text-blue-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-100">CloudTrail Raw Event JSON</h3>
            <span className="font-mono text-[11px] text-gray-400">({event.eventID})</span>
          </div>

          <div className="flex items-center gap-2 font-mono">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 rounded border border-gray-700 bg-[#0B0E14] px-2 py-0.5 text-[10px] font-medium text-gray-300 hover:bg-gray-800 hover:text-white"
            >
              {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
              <span>{copied ? 'Copied' : 'Copy JSON'}</span>
            </button>
            <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <pre className="rounded bg-[#0B0E14] p-3 font-mono text-[11px] text-green-400 leading-relaxed overflow-x-auto border border-gray-800">
            {JSON.stringify(event, null, 2)}
          </pre>
        </div>

        <div className="flex justify-end border-t border-gray-800 px-4 py-2.5 bg-[#161B22] font-mono">
          <button
            onClick={onClose}
            className="rounded border border-gray-800 bg-[#0B0E14] px-3 py-1 text-xs font-medium text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
