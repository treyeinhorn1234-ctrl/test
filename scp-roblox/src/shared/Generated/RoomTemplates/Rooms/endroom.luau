--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "endroom",
	description = "Red-lit dead end room with a large, unopenable gate.",
	shape = "1",
	commonness = 100,
	large = false,
	disableDecals = false,
	zones = { 1, 3 },
	asset = "endroom",
	boundsMin = { -18, -0.025, -31 },
	boundsMax = { 19.6, 17.7, 25.6 },
	triggerBoxes = {},
	lights = {
		{
			position = { -6.4, 17.2, -12.8 },
			range = 22.5,
			color = { 255, 50, 50 },
			brightness = 1.5,
		},
		{
			position = { 6.4, 17.2, -12.8 },
			range = 22.5,
			color = { 255, 50, 50 },
			brightness = 1.5,
		},
		{
			position = { 0, 17.2, 6.4 },
			range = 22.5,
			color = { 255, 50, 50 },
			brightness = 1.5,
		},
	},
	spotlights = {},
	waypoints = {
		{ 0, 2.4, -4.8 },
	},
	sounds = {
		{
			position = { 0, 4.8, -38.4 },
			ambience = 6,
			range = 10,
		},
	},
	screens = {},
	props = {
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { 0, 15.5, 12.8 },
			rotation = { 1, 0, 0, 0, 1, 0, 0, 0, 1 },
			scale = { 1, 1, 1 },
		},
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { 0, 15.5, 0 },
			rotation = { 1, 0, 0, 0, 1, 0, 0, 0, 1 },
			scale = { 1, 1, 1 },
		},
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { 0, 15.5, -12.8 },
			rotation = { 1, 0, 0, 0, 1, 0, 0, 0, 1 },
			scale = { 1, 1, 1 },
		},
	},
	playerStarts = {},
}
