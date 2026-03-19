export class ObjectPool {
  constructor(factory, reset, initialSize = 10) {
    this.factory = factory
    this.reset = reset
    this.pool = []

    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory())
    }
  }

  get() {
    return this.pool.length > 0 ? this.pool.pop() : this.factory()
  }

  release(obj) {
    this.reset(obj)
    this.pool.push(obj)
  }
}