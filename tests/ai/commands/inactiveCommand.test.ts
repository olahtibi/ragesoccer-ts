import { assertEqual, test } from "../../testlib";
import { makeFixture } from "../../helpers";
import { IndividualAi } from "../../../src/ai/individualAi";

test("inactive leaves velocity unchanged", function () {
  var fixture = makeFixture();
  var ai = new IndividualAi(
    fixture.config,
    fixture.awayTeam,
    fixture.playerAway,
  );
  fixture.playerAway.velocity.x = 2;
  fixture.playerAway.velocity.y = 3;

  ai.setCommand("inactive", null);
  ai.update({ ball: fixture.ball, attackTarget: null });

  assertEqual(fixture.playerAway.velocity.x, 2);
  assertEqual(fixture.playerAway.velocity.y, 3);
  assertEqual(ai.debugSnapshot().state, "stopped");
});
