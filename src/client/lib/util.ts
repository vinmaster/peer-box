export class Util {
  static IS_DEV = (import.meta as any).env.DEV;

  static remove(array: any[], element: any) {
    let index = array.indexOf(element);
    if (index !== -1) array.splice(index, 1);
  }
}
