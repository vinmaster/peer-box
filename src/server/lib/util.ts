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
}
