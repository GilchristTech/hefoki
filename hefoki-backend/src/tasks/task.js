export default class Task {
  constructor (name, args=undefined, task={}) {
    if (typeof name !== "string")
      throw TypeError("Task constructor requires a string for the name argument");

    if (typeof task === "function") {
      task = { taskFunction: task };
    }

    this.args = args;
    this.name = name;

    this.started    = false;
    this.finished   = false;
    this.resolved   = false;
    this.exception  = null;

    this.start_time = task.start_time ?? null;
    this.end_time   = task.end_time   ?? null;
    this.tasks      = task.tasks      ?? {};
    this.details    = task.details    ?? {};

    this.exclude    = new Set(task.exclude) ?? new Set();

    this.promise     = null;

    if (task.taskFunction) {
      this.taskFunction = task.taskFunction;
    }
  }

  async handler (task) {
    if (this.taskFunction) {
      return await this.taskFunction(...arguments);
    }
  }

  async run () {
    this.started    = true;
    this.start_time = new Date();

    // Get arguments and run the task
    //
    const args   = Array.isArray(this.args) ? this.args : [ this.args ];
    this.promise = this.handler(this, ...args);

    try {
      const details = (await this.promise) ?? null;

      // Wait for all sub-tasks to finish running, also starting each which
      // hasn't started already.
      //
      await this.runSubtasks();

      this.resolve(details ?? null, 200);
    }
    catch (err) {
      this.error(err);
      throw err;
    }

    return this.details;
  }

  async runSubtasks () {
    return await Promise.all(
      Object.values(this.tasks).map(task => {
        if (! task.started) {
          task.run();
        }
        return task.promise;
      })
    );
  }

  async runSubtask (task) {
    if (arguments.length === 0 || arguments.length > 3) {
      throw new TypeError("Expects one, two, or three arguments");
    }

    if (task instanceof Task) {
      task.name ??= Object.values(this.tasks).length;
      this.tasks[task.name] = task;
      return await task.run();
    }

    if (arguments.length === 3) {
      task = new Task(...arguments);
    }
    else if (arguments.length === 2) {
      task = new Task(arguments[0], null, arguments[1]);
    }
    else {  // Number of arguments is one
      task = new Task(`task-${this.tasks.length}`, null, arguments[0]);
    }

    task.name ??= Object.values(this.tasks).length;
    this.tasks[task.name] = task;
    return await task.run();
  }

  resolve (details=null, code=200) {
    this.__status = code;
    this.resolved = true;
    this.details  = details;
    this.finish();
  }
  
  error (exception=true, code=500) {
    this.__status  = code;
    this.exception = exception;
    this.resolved  = false;
    this.finish();
  }

  finish () {
    this.started  = true;
    this.finished = true;
    this.end_time = new Date();
  }

  get status () {
    if (this.finished === false)
      return 102;  // Processing

    if (this.__status)
      return this.__status;

    const status_codes = new Set(
        Object.values(this.tasks).map(
            (task) => task.status
          )
      );

    if (status_codes.length > 1) {
      return 207;  // Multiple status codes
    }

    if (this.resolved) {
      return 200;  // Success
    }
    else if (this.exception) {
      return 500;  // Internal error
    }

    return null;
  }

  get duration () {
    if (this.start_time && this.end_time) {
      return this.end_time.getTime() - this.start_time.getTime();
    }
    return null;
  }

  toJSON () {
    let details = this.details;

    if (Array.isArray(details)) {
      // pass
    }
    else if (details && typeof details === "object") {
      details = Object.fromEntries(
        Object.entries(this.details).filter(( [key, value] ) => ! this.exclude.has(key))
      );
    }

    return {
      name:       this.name,
      resolved:   this.resolved,
      exception:  this.exception?.toString(),
      status:     this.status,

      start_time: this.start_time,
      end_time:   this.end_time,
      duration:   this.duration,

      tasks:      this.tasks,
      details,
    };
  }
}
