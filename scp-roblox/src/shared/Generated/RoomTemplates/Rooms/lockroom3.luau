--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "lockroom3",
	description = "A varient of the timed lockroom, where a seperate path is opened. The airlock itself is broken.",
	shape = "2C",
	commonness = 15,
	large = false,
	disableDecals = false,
	zones = { 1 },
	asset = "lockroom3",
	boundsMin = { -20.8, 0, -21.6 },
	boundsMax = { 25.6, 9.6, 25.75 },
	triggerBoxes = {},
	lights = {
		{
			position = { 20.8, 8.2, -5.6 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1.2,
		},
		{
			position = { -5.6, 8.2, 20 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1.2,
		},
		{
			position = { 20.8, 9.2, 20.8 },
			range = 12.5,
			color = { 255, 255, 255 },
			brightness = 1,
		},
	},
	spotlights = {},
	waypoints = {
		{ 20.7, 0.8, 0.025 },
		{ 20.7, 0.8, -18.375 },
		{ -18.5, 0.8, 20.425 },
		{ -0.1, 0.8, 20.825 },
		{ 20.5, 0.8, 20.125 },
	},
	sounds = {},
	screens = {},
	props = {
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { 20.8, 8.2, -5.6 },
			rotation = { 1, 0, 0, 0, 1, 0, 0, 0, 1 },
			scale = { 1, 1, 1 },
		},
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { -5.6, 8.2, 20 },
			rotation = { 1, 0, 0, 0, 1, 0, 0, 0, 1 },
			scale = { 1, 1, 1 },
		},
	},
	playerStarts = {},
}
