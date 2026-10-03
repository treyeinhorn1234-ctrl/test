--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room2_3",
	description = "A larger version of the two-door hallway, with lights in the floor.",
	shape = "2",
	commonness = 35,
	large = false,
	disableDecals = false,
	zones = { 1 },
	asset = "room2_3",
	boundsMin = { -10.4, -0.5, -25.6 },
	boundsMax = { 10.4, 14.906, 25.6 },
	triggerBoxes = {},
	lights = {},
	spotlights = {},
	waypoints = {
		{ 0, 1.65, 0 },
	},
	sounds = {},
	screens = {},
	props = {
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { 0, 12.3, 12.8 },
			rotation = { 1, 0, 0, 0, 1, 0, 0, 0, 1 },
			scale = { 1, 1, 1 },
		},
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { 0, 12.3, -12.8 },
			rotation = { 1, 0, 0, 0, 1, 0, 0, 0, 1 },
			scale = { 1, 1, 1 },
		},
	},
	playerStarts = {},
}
