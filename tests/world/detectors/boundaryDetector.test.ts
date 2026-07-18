import { assertEqual, assertNear, assertTrue, test } from "../../testlib";
import { makeFixture } from "../../helpers";

test("BoundaryDetector reports the first edge crossed with last-touch ownership", function () {
  var fixture = makeFixture();
  fixture.ball.lastTouchedBy = "home";
  fixture.ball.position.x =
    fixture.config.pitch.fieldLeft - fixture.config.ball.radius - 10;
  fixture.ball.position.y =
    fixture.config.pitch.fieldTop - fixture.config.ball.radius - 20;

  var event = fixture.boundaryDetector.update();
  assertTrue(event !== null);

  assertEqual(event.boundary, "top");
  assertEqual(event.lastTouchedBy, "home");
  assertNear(
    event.position.y,
    fixture.config.pitch.fieldTop - fixture.config.ball.radius,
    0.0001,
  );
});

test("BoundaryDetector reports an outside spell only once", function () {
  var fixture = makeFixture();
  fixture.ball.position.x =
    fixture.config.pitch.fieldRight + fixture.config.ball.radius + 1;

  var event = fixture.boundaryDetector.update();
  assertTrue(event !== null);
  assertEqual(event.boundary, "right");
  assertEqual(fixture.boundaryDetector.update(), null);
});

test("BoundaryDetector is inactive when out-of-play restarts are disabled", function () {
  var fixture = makeFixture({ outOfPlayRestartsEnabled: false });
  fixture.ball.position.x =
    fixture.config.pitch.fieldRight + fixture.config.ball.radius + 1;

  assertEqual(fixture.boundaryDetector.update(), null);
});
