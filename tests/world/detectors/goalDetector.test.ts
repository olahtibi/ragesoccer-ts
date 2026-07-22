import { assertEqual, test } from "../../testlib";
import { makeFixture } from "../../helpers";
import { world } from "../../../src/core/configuration";

test("GoalDetector scores home when ball enters top goal", function () {
  var fixture = makeFixture();
  fixture.ball.position.x = world(336);
  fixture.ball.position.y = world(100);

  var scoredBy = fixture.goalDetector.update();

  assertEqual(scoredBy, "home");
});

test("GoalDetector scores away when ball enters bottom goal", function () {
  var fixture = makeFixture();
  fixture.ball.position.x = world(336);
  fixture.ball.position.y = world(758);

  var scoredBy = fixture.goalDetector.update();

  assertEqual(scoredBy, "away");
});

test("GoalDetector does not double-count a ball that remains inside a goal", function () {
  var fixture = makeFixture();
  fixture.ball.position.x = world(336);
  fixture.ball.position.y = world(100);

  var first = fixture.goalDetector.update();
  var second = fixture.goalDetector.update();

  assertEqual(first, "home");
  assertEqual(second, null);
});

test("GoalDetector resets after the ball exits the goals", function () {
  var fixture = makeFixture();
  fixture.ball.position.x = world(336);
  fixture.ball.position.y = world(100);
  fixture.goalDetector.update();

  fixture.ball.position.x = world(336);
  fixture.ball.position.y = world(433);
  fixture.goalDetector.update();

  fixture.ball.position.y = world(100);
  assertEqual(fixture.goalDetector.update(), "home");
});
