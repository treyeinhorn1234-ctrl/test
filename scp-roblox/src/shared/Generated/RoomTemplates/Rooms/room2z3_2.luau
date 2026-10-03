--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room2z3_2",
	description = "A varient of the two-door hallway.",
	shape = "2",
	commonness = 25,
	large = false,
	disableDecals = false,
	zones = { 3 },
	asset = "room2z3_2",
	boundsMin = { -7.6, -0.025, -25.6 },
	boundsMax = { 7.6, 10.4, 25.6 },
	parts = {
		officewall = { 0, 4.8, 0, 15.2, 9.6, 51.2 },
		ceiling = { 0, 10, 0, 15.2, 0.8, 51.2 },
		misc = { 0, 10, -0.4, 4.2, 0.8, 50.4 },
		tilefloor = { 0, -0.013, 0, 12.8, 0.025, 51.2 },
	},
	triggerBoxes = {},
	lights = {},
	spotlights = {},
	waypoints = {
		{ 0, 2, 7.9938 },
		{ 0, 2, -7.9938 },
	},
	sounds = {},
	screens = {},
	props = {
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { 0, 8.3, 12.8 },
			rotation = { 1, 0, 0, 0, 1, 0, 0, 0, 1 },
			scale = { 1, 1, 1 },
		},
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { 0, 8.3, -12.8 },
			rotation = { -1, 0, 0, 0, 1, 0, 0, 0, -1 },
			scale = { 1, 1, 1 },
		},
	},
	playerStarts = {},
}
