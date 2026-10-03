--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room3z2",
	description = "A T-shaped, three-door hallway.",
	shape = "3",
	commonness = 100,
	large = false,
	disableDecals = false,
	zones = { 2 },
	asset = "room3z2",
	boundsMin = { -25.6, -0.8, -6.4 },
	boundsMax = { 25.6, 10.4, 25.6 },
	triggerBoxes = {},
	lights = {
		{
			position = { 6.4, 9.2, 0 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1.2,
		},
		{
			position = { -3.2, 9.2, 0 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1.2,
		},
		{
			position = { 0, 9.2, 9.6 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1.2,
		},
	},
	spotlights = {},
	waypoints = {
		{ 0, 0.9, 1.6 },
	},
	sounds = {},
	screens = {},
	props = {
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { -16.4, 8, 0 },
			rotation = { 0, 0, -1, 0, 1, 0, 1, 0, 0 },
			scale = { 1, 1, 1 },
		},
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { 16.4, 8, 0 },
			rotation = { 0, 0, -1, 0, 1, 0, 1, 0, 0 },
			scale = { 1, 1, 1 },
		},
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { 0, 8, 18.2 },
			rotation = { 0, 0, -1, 0, 1, 0, 1, 0, 0 },
			scale = { 1, 1, 1 },
		},
	},
	playerStarts = {},
}
