export function UploadSlot({ onUpload }: { onUpload: () => void }) {
  return (
    <button className="upload-slot" onClick={onUpload} aria-label="上架书籍">
      <span className="slot-book">
        <span className="slot-plus">+</span>
      </span>
      <span className="slot-label">上架书籍</span>
    </button>
  );
}
