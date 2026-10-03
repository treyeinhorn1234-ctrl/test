--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room2_5",
	description = "A two-door hallway, with lowered ceilings.",
	shape = "2",
	commonness = 35,
	large = false,
	disableDecals = false,
	zones = { 1 },
	asset = "room2_5",
	boundsMin = { -7.6, -0.025, -25.6 },
	boundsMax = { 8, 9.6717, 25.6 },
	parts = {
		whitewall = { 0, 4.8, 0, 15.2, 9.6, 51.2 },
		concretefloor = { 0.2, 4.788, 0, 15.6, 9.625, 51.2 },
		misc = { 0.024, 9.624, 0, 0.6, 0.096, 39.4 },
		dirtymetal = { 0, 7.8, 0, 14.8, 1.6, 41.6 },
	},
	triggerBoxes = {},
	lights = {
		{
			position = { 0.0261, 9.3239, 0 },
			range = 15,
			color = { 255, 255, 255 },
			brightness = 1,
		},
		{
			position = { 0.0261, 9.3239, -19.2 },
			range = 15,
			color = { 255, 255, 255 },
			brightness = 1,
		},
		{
			position = { 0.0261, 9.3239, 19.2 },
			range = 15,
			color = { 255, 255, 255 },
			brightness = 1,
		},
	},
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
			position = { 0, 8.3, -12.8 },
			rotation = { 1, 0, 0, 0, 1, 0, 0, 0, 1 },
			scale = { 1, 1, 1 },
		},
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { 0, 8.3, 12.8 },
			rotation = { 1, 0, 0, 0, 1, 0, 0, 0, 1 },
			scale = { 1, 1, 1 },
		},
	},
	playerStarts = {},
}
