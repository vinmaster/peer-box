export class Util {
  static generateId(length = 4): string {
    let max = Math.pow(10, length) - 1;
    let num = Math.floor(Math.random() * max) + 1;
    return num.toString().padStart(length, '0');
  }

  static remove(array: any[], element: any) {
    let index = array.indexOf(element);
    if (index !== -1) array.splice(index, 1);
  }

  static formatBytes(bytes, decimals = 2) {
    if (bytes === undefined || bytes === null) return 'No info';
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
  }
}
