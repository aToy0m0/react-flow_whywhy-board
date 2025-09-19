"use client";
import { 
  Save, 
  Upload, 
  Download, 
  FileText, 
  Image as ImageIcon,
  Database,
  RefreshCw,
  X 
} from 'lucide-react';
import type { BoardHandle } from './boardActions';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  boardRef: React.RefObject<BoardHandle>;
  fileRef: React.RefObject<HTMLInputElement>;
}

export default function Sidebar({ isOpen, onClose, boardRef, fileRef }: SidebarProps) {
  return (
    <>
      {/* サイドパネル */}
      <div className={`fixed left-0 top-0 h-full bg-white/95 backdrop-blur-xl shadow-2xl transition-transform duration-300 ease-in-out z-30 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`} style={{ width: '280px' }}>
        
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h1 className="text-lg font-bold text-blue-900">WhyWhyボード</h1>
            <h2 className="text-sm font-semibold text-blue-800">メニュー</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">保存・読み込み</h3>
            
            <button 
              onClick={() => boardRef.current?.saveLocal()}
              className="flex items-center w-full p-4 text-left bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <Save size={20} className="mr-4" />
              <div>
                <div className="font-semibold">一時保存</div>
                <div className="text-xs opacity-80">作業内容を安全に保存</div>
              </div>
            </button>

            <button 
              onClick={() => boardRef.current?.loadLocal()}
              className="flex items-center w-full p-4 text-left bg-white hover:bg-gray-50 rounded-xl transition-all duration-200 border border-gray-200 hover:border-gray-300 hover:shadow-md"
            >
              <Upload size={20} className="text-indigo-600 mr-4" />
              <div>
                <div className="font-semibold text-gray-800">一時読込</div>
                <div className="text-xs text-gray-500">保存済みファイルを読み込み</div>
              </div>
            </button>

            <button 
              onClick={() => boardRef.current?.saveRemote?.()}
              className="flex items-center w-full p-4 text-left bg-white hover:bg-gray-50 rounded-xl transition-all duration-200 border border-blue-200 hover:border-blue-300 hover:shadow-md"
            >
              <Database size={20} className="text-blue-600 mr-4" />
              <div>
                <div className="font-semibold text-gray-800">サーバ保存</div>
                <div className="text-xs text-gray-500">データベースへ保存</div>
              </div>
            </button>

            <button 
              onClick={() => boardRef.current?.loadRemote?.()}
              className="flex items-center w-full p-4 text-left bg-white hover:bg-gray-50 rounded-xl transition-all duration-200 border border-blue-200 hover:border-blue-300 hover:shadow-md"
            >
              <RefreshCw size={20} className="text-blue-600 mr-4" />
              <div>
                <div className="font-semibold text-gray-800">サーバ読込</div>
                <div className="text-xs text-gray-500">最新状態へ更新</div>
              </div>
            </button>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">エクスポート</h3>
            
            <button 
              onClick={() => boardRef.current?.exportToml()}
              className="flex items-center w-full p-4 text-left bg-white hover:bg-gray-50 rounded-xl transition-all duration-200 border border-gray-100 hover:border-gray-200 hover:shadow-md group"
            >
              <Download size={20} className="text-emerald-600 mr-4 group-hover:scale-110 transition-transform" />
              <div>
                <div className="font-semibold text-gray-800">ファイル出力</div>
                <div className="text-xs text-gray-500">TOML形式で出力</div>
              </div>
            </button>

            <button 
              onClick={() => fileRef.current?.click()}
              className="flex items-center w-full p-4 text-left bg-white hover:bg-gray-50 rounded-xl transition-all duration-200 border border-gray-100 hover:border-gray-200 hover:shadow-md group"
            >
              <FileText size={20} className="text-violet-600 mr-4 group-hover:scale-110 transition-transform" />
              <div>
                <div className="font-semibold text-gray-800">ファイル読込</div>
                <div className="text-xs text-gray-500">TOMLファイルを読み込み</div>
              </div>
            </button>

            <button 
              onClick={() => boardRef.current?.exportPng()}
              className="flex items-center w-full p-4 text-left bg-white hover:bg-gray-50 rounded-xl transition-all duration-200 border border-gray-100 hover:border-gray-200 hover:shadow-md group"
            >
              <ImageIcon size={20} className="text-orange-600 mr-4 group-hover:scale-110 transition-transform" aria-hidden />
              <div>
                <div className="font-semibold text-gray-800">PNG書き出し</div>
                <div className="text-xs text-gray-500">高品質画像として保存</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* オーバーレイ */}
      {isOpen && <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-20" onClick={onClose} />}
    </>
  );
}
