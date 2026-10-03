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
	parts = {
		containment_doors = { 0, 5.161, -28.4, 21.964, 10.351, 4.604 },
		tilefloor = { 0.2, -0.013, -1.6, 36.4, 0.025, 54.4 },
		concretefloor = { 0.2, 17.65, -1.6, 36.4, 0.1, 54.4 },
		dirtymetal = { 0.025, 7.9, -5.1, 35.65, 15.8, 51.8 },
		whitewall = { 0.8, 8.8, -0.6, 37.6, 17.6, 52.4 },
		metalpanels2 = { 0.8, 11.175, 0.1, 37.6, 4.85, 49.8 },
		misc = { -0.024, 17.624, -3.2, 13.4, 0.096, 20.2 },
	},
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
