import * as Frontend from '../frontend.js';

describe("mergeIndexedArrays", () => {
    it("links lists", () => {
        const merged = Frontend.mergeIndexedArrays(
            [  1,2,3  ],
            [0,  2,3,4],
        );

        expect(merged.length).toBe(5);

        expect(merged[0]).toEqual({
            index:      0,
            a_value: null, b_value:    0,
            prev:    null, next:       1,
            a_prev:  null, a_next:  null,
            b_prev:  null, b_next:     2,
        });

        expect(merged[1]).toEqual({
            index:      1,
            a_value:    1, b_value: null,
            prev:       0, next:       2,
            a_prev:  null, a_next:     2,
            b_prev:  null, b_next:  null,
        });

        expect(merged[2]).toEqual({
            index:      2,
            a_value:    2, b_value:    2,
            prev:       1, next:       3,
            a_prev:     1, a_next:     3,
            b_prev:     0, b_next:     3,
        });

        expect(merged[3]).toEqual({
            index:      3,
            a_value:    3, b_value:    3,
            prev:       2, next:       4,
            a_prev:     2, a_next:  null,
            b_prev:     2, b_next:     4,
        });

        expect(merged[4]).toEqual({
            index:      4,
            a_value: null, b_value:    4,
            prev:       3, next:    null,
            a_prev:  null, a_next:  null,
            b_prev:     3, b_next:  null,
        });
    });
});
