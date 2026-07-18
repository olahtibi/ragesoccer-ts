import { assertEqual, assertTrue, test } from "../testlib";
import { canvasContext, makeFixture } from "../helpers";

test("Stadium is a world aggregate without AI restart or scoring APIs", function () {
  var fixture = makeFixture({ homeTeamSize: 3, awayTeamSize: 2 });

  assertEqual(fixture.stadium.players.length, 5);
  assertEqual("updateAi" in fixture.stadium, false);
  assertEqual("updateKickoff" in fixture.stadium, false);
  assertEqual("goalDetector" in fixture.stadium, false);
});

test("Stadium draw renders the pitch ball and every player", function () {
  var fixture = makeFixture({ homeTeamSize: 2, awayTeamSize: 3 });
  var drawCount = 0;
  var ctx = {
    drawImage: function () {
      drawCount++;
    },
    beginPath: function () {},
    moveTo: function () {},
    lineTo: function () {},
    closePath: function () {},
    stroke: function () {},
  };

  fixture.stadium.draw(canvasContext(ctx));

  assertEqual(drawCount, 8);
});

test("Stadium marks the team-owned human player", function () {
  var fixture = makeFixture({ homeTeamSize: 2, awayTeamSize: 1 });
  var strokes = 0;
  var ctx = {
    drawImage: function () {},
    beginPath: function () {},
    moveTo: function () {},
    lineTo: function () {},
    closePath: function () {},
    stroke: function () {
      strokes++;
    },
  };

  fixture.stadium.draw(canvasContext(ctx));

  assertEqual(strokes, 1);
  assertTrue(
    fixture.homeTeam.humanPlayer ===
      fixture.restartController.taker(fixture.homeTeam),
  );
});
