export function UploadSlot({ onUpload }: { onUpload: () => void }) {
  return (
    <button className="upload-slot" onClick={onUpload} aria-label="放入一本新书">
      <span className="slot-book">
        <span className="slot-plus">+</span>
      </span>
      <span className="slot-label">放入新书</span>
    </button>
  );
}
