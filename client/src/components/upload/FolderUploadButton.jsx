export function FolderUploadButton({ onFiles }) {
  const handleChange = (e) => {
    const files = Array.from(e.target.files ?? []).map((file) => ({
      file,
      relativePath: file.webkitRelativePath || file.name,
    }))
    onFiles(files)
    e.target.value = '' // allow re-selecting the same folder later
  }

  return (
    <label className="ll-btn ll-btn-ghost" style={{ fontSize: 13, cursor: 'pointer' }}>
      Upload folder
      <input
        type="file"
        multiple
        webkitdirectory=""
        directory=""
        onChange={handleChange}
        style={{ display: 'none' }}
      />
    </label>
  )
}