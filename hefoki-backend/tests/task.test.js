import { expect, describe, it } from "vitest";
import Task from "../src/tasks/task.js";

describe("Test class", () => {
  it("Can run a task function", async () => {
    const task = new Task("test-task", [], {
      taskFunction: (task) => task.name
    });

    expect( task.status ).toBe(102);

    await task.run();

    expect( task.finished  ).toBeTruthy();
    expect( task.exception ).toBeFalsy();
    expect( task.resolved  ).toBeTruthy()
    expect( task.status    ).toEqual(200);
    expect( task.details   ).toEqual("test-task");
  });

  it ("Runs subtasks", async () => {
    const subtask_1 = new Task("subtask1", [], { taskFunction: (task) => task.name });
    const subtask_2 = new Task("subtask2", [], { taskFunction: (task) => task.name });

    const task = new Task("root", [], {
      taskFunction: async (task) => {
        return [
          await task.runSubtask( subtask_1 ),
          await task.runSubtask( subtask_2 ),
        ];
      }
    });

    await task.run();

    expect( task.exception ).toBeFalsy();
    expect( task.status    ).toBe(200);
    expect( task.finished  ).toBeTruthy();

    expect( task.tasks.subtask1.exception ).toBeFalsy();
    expect( task.tasks.subtask1.status    ).toBe(200);
    expect( task.tasks.subtask1.finished  ).toBeTruthy();

    expect( task.tasks.subtask2.exception ).toBeFalsy();
    expect( task.tasks.subtask2.status    ).toBe(200);
    expect( task.tasks.subtask2.finished  ).toBeTruthy();

    expect( task.details ).toEqual([
      "subtask1",
      "subtask2",
    ]);
  });

  describe("toJSON()", () => {
    it("can exclude properties", async () => {
      const task = new Task("test", [], {
        exclude: [ "excluded" ],
        taskFunction: () => ({
          included: true,
          excluded: true,
        })
      });

      const details = await task.run();

      const filtered_details = task.toJSON().details;
      expect(filtered_details).toEqual({
        included: true
      });
    });

    it("nests subtasks", async () => {
      const supertask = new Task("supertask", [], {
        taskFunction: async (task) => [
          await task.runSubtask("subtask1", (task) => "subtask details 1"),
          await task.runSubtask("subtask2", (task) => "subtask details 2"),
        ]
      });

      await supertask.run();

      // Encode and decode supertask to recurse toJSON calls
      const json = JSON.parse( JSON.stringify(supertask) );
      expect(json.tasks.subtask1.details).toBe("subtask details 1");
      expect(json.tasks.subtask2.details).toBe("subtask details 2");
    });
  });
});
