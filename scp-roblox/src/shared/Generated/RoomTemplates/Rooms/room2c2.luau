--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room2c2",
	description = "A corner room, with more of a LCZ style.",
	shape = "2C",
	commonness = 30,
	large = false,
	disableDecals = false,
	zones = { 1 },
	asset = "room2c2",
	boundsMin = { -8, 0, -25.6 },
	boundsMax = { 25.6, 20.0217, 25.6 },
	triggerBoxes = {},
	lights = {
		{
			position = { 15.2858, 19.6739, 0 },
			range = 16.25,
			color = { 255, 255, 255 },
			brightness = 1.4,
		},
		{
			position = { -0.012, 19.6739, 15.2023 },
			range = 16.25,
			color = { 255, 255, 255 },
			brightness = 1.4,
		},
		{
			position = { -0.012, 19.6739, -15.1977 },
			range = 16.25,
			color = { 255, 255, 255 },
			brightness = 1.4,
		},
	},
	spotlights = {},
	waypoints = {
		{ 9.5, 1.65, 0.1 },
		{ -0.1, 1.65, 9.7 },
	},
	sounds = {},
	screens = {},
	props = {
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { 9.6, 18.7, 0 },
			rotation = { 0, 0, 1, 0, 1, 0, -1, 0, 0 },
			scale = { 1, 1, 1 },
		},
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { 0, 18.7, 9.6 },
			rotation = { 1, 0, 0, 0, 1, 0, 0, 0, 1 },
			scale = { 1, 1, 1 },
		},
		{
			model = "elecbox",
			file = "elecbox.x",
			position = { 1.2782, 2.6, -21.4462 },
			rotation = { -1, 0, 0, 0, 1, 0, 0, 0, -1 },
			scale = { 13, 13, 13 },
		},
	},
	playerStarts = {},
}
