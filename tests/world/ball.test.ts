import { assertEqual, assertNear, test } from "../testlib";
import { canvasContext, makeFixture } from "../helpers";
import { Vector3 } from "../../src/math/vector";

test("Ball placement resets all velocity components", function () {
  var fixture = makeFixture();
  fixture.ball.velocity.x = 1;
  fixture.ball.velocity.y = 2;
  fixture.ball.velocity.z = 3;
  fixture.ball.intendedReceiver = fixture.playerHome;

  fixture.ball.placeAt(new Vector3(10, 20, 0));

  assertEqual(fixture.ball.position.x, 10);
  assertEqual(fixture.ball.position.y, 20);
  assertEqual(fixture.ball.velocity.x, 0);
  assertEqual(fixture.ball.velocity.y, 0);
  assertEqual(fixture.ball.velocity.z, 0);
  assertEqual(fixture.ball.intendedReceiver, null);
});

function drawingContext(): CanvasRenderingContext2D {
  return canvasContext({ drawImage: function () {} });
}

test("Ball draw advances its animation by distance travelled", function () {
  var fixture = makeFixture();
  var ball = fixture.ball;
  var ctx = drawingContext();

  ball.position.x += fixture.config.ball.spinPxPerPhase * 2 + 1;
  ball.draw(ctx);

  assertEqual(ball.phaseIndex, 2);
  assertNear(ball.rollDistance, 1, 0.0001);
});

test("Ball draw resets partial roll distance while stationary", function () {
  var fixture = makeFixture();
  var ball = fixture.ball;
  var ctx = drawingContext();

  ball.position.x += fixture.config.ball.spinPxPerPhase - 1;
  ball.draw(ctx);
  ball.draw(ctx);

  assertEqual(ball.phaseIndex, 0);
  assertEqual(ball.rollDistance, 0);
});

test("Ball does not animate while held and starts from its release position", function () {
  var fixture = makeFixture();
  var ball = fixture.ball;
  var taker = fixture.playerHome;
  var ctx = drawingContext();

  ball.heldBy = taker;
  ball.draw(ctx);
  taker.position.x += fixture.config.ball.spinPxPerPhase * 3;
  ball.draw(ctx);

  assertEqual(ball.phaseIndex, 0);
  assertEqual(ball.rollDistance, 0);

  var held = ball.heldPosition();
  ball.position.x = held.x;
  ball.position.y = held.y;
  ball.heldBy = null;
  ball.draw(ctx);

  assertEqual(ball.phaseIndex, 0);
  assertEqual(ball.rollDistance, 0);
});
