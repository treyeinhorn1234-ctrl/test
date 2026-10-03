--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "medibay",
	description = "A two-door hallway, leading to the medical bay. Contains a zombie.",
	shape = "2",
	commonness = 0,
	large = false,
	disableDecals = false,
	zones = { 3 },
	asset = "medibay",
	boundsMin = { -25.6, -0.0461, -25.6 },
	boundsMax = { 7.2, 9.6717, 25.625 },
	triggerBoxes = {},
	lights = {
		{
			position = { -9.7011, 9.3239, -16 },
			range = 15,
			color = { 255, 255, 255 },
			brightness = 0.8,
		},
		{
			position = { -0.0761, 9.3239, -23.2 },
			range = 15,
			color = { 255, 255, 255 },
			brightness = 0.8,
		},
		{
			position = { -0.0261, 9.3239, -6.4 },
			range = 15,
			color = { 255, 255, 255 },
			brightness = 0.8,
		},
		{
			position = { -0.1011, 9.3239, 6.4 },
			range = 15,
			color = { 255, 255, 255 },
			brightness = 0.8,
		},
		{
			position = { -0.0261, 9.3239, 23.2 },
			range = 15,
			color = { 255, 255, 255 },
			brightness = 0.8,
		},
	},
	spotlights = {
		{
			position = { -9.7, 9.4, 1 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1.2,
			direction = { 0, -1, 0 },
			innerCone = 35,
			outerCone = 45,
		},
	},
	waypoints = {
		{ 0, 2.4, 0 },
		{ 0, 2.4, -16 },
		{ -13.6, 2.4, -2.4 },
		{ -19.05, 2.4, 8.65 },
		{ -12.8, 2.4, -16 },
	},
	sounds = {},
	screens = {},
	props = {},
	playerStarts = {},
}
