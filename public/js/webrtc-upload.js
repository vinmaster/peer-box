/* global Uppy */
/* eslint-disable no-console */

class WebRTCUpload extends Uppy.Core.Plugin { // eslint-disable-line no-unused-vars
  constructor(uppy, opts) {
    super(uppy, opts);
    this.opts = opts;
    this.type = 'uploader';
    this.id = 'WebRTCUpload';
    this.title = 'WebRTCUpload';
    this.chunkSize = 16384;
    this.peerConnection = opts.peerConnection;

    this.handleUpload = this.handleUpload.bind(this);
  }

  upload(file) {
    return new Promise(((resolve, reject) => {
      try {
        let offset = 0;
        const fileReader = new FileReader();
        const readSlice = currentChunk => {
          const slice = file.data.slice(offset, currentChunk + this.chunkSize);
          fileReader.readAsArrayBuffer(slice);
        };

        fileReader.onload = e => {
          this.peerConnection.send(e.target.result);
          offset += e.target.result.byteLength;

          this.uppy.emit('upload-progress', file, {
            uploader: this,
            id: file.id,
            bytesTotal: file.size,
            bytesUploaded: offset,
          });

          if (offset < file.size) {
            readSlice(offset);
          } else {
            this.uppy.emit('upload-success', file, {
              status: 'done',
            });
            resolve(file);
          }
        };

        readSlice(0);
      } catch (error) {
        console.error(error);
        this.uppy.emit('upload-error', file, error);
        reject(error);
      }
    }));
  }

  async uploadFiles(files) {
    for (const file of files) {
      if (file.error) {
        return Promise.reject(new Error(file.error));
      }
      this.uppy.emit('upload-started', file);
      await this.upload.call(this, file);
    }
  }

  handleUpload(fileIds) {
    if (fileIds.length === 0) {
      this.uppy.log(`[${this.title}] No files to upload`);
      return Promise.resolve();
    }

    this.uppy.log(`[${this.title}] Upload starting`);
    const files = fileIds.map(fileId => this.uppy.getFile(fileId));

    return this.uploadFiles(files).then(() => null);
  }

  install() {
    this.uppy.addUploader(this.handleUpload);
  }

  uninstall() {
    this.uppy.removeUploader(this.handleUpload);
  }
}
