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
    fixture.homeTeam.humanPlayer === fixture.restartController.taker("home"),
  );
});

test("Stadium can hide the human player marker while movement is locked", function () {
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

  fixture.stadium.draw(canvasContext(ctx), false);

  assertEqual(strokes, 0);
});

test("Stadium depth sorts player and ball bodies by ground position", function () {
  var fixture = makeFixture({ homeTeamSize: 1, awayTeamSize: 1 });
  var order: string[] = [];
  fixture.homePlayers[0].position.y = 300;
  fixture.awayPlayers[0].position.y = 100;
  fixture.ball.position.y = 200;
  fixture.homePlayers[0].draw = function () {
    order.push("home");
  };
  fixture.awayPlayers[0].draw = function () {
    order.push("away");
  };
  fixture.ball.drawShadow = function () {
    order.push("shadow");
  };
  fixture.ball.drawBody = function () {
    order.push("ball");
  };

  fixture.stadium.draw(canvasContext({ drawImage: function () {} }), false);

  assertEqual(order.join(","), "shadow,away,ball,home");
});
