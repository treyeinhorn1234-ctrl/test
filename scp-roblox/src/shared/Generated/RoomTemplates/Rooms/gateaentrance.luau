--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "gateaentrance",
	description = "The room with the elevator to Gate A.",
	shape = "1",
	commonness = 0,
	large = false,
	disableDecals = false,
	zones = { 3 },
	asset = "gateaentrance",
	boundsMin = { -18, -0.8, -31 },
	boundsMax = { 34, 33.2, 28.4 },
	triggerBoxes = {},
	lights = {
		{
			position = { 0, 17.2, 19.2 },
			range = 25,
			color = { 255, 50, 50 },
			brightness = 1.5,
		},
		{
			position = { 26.4739, 11.7239, -12.8 },
			range = 15,
			color = { 255, 255, 255 },
			brightness = 1,
		},
		{
			position = { 4.9, 23.2, -11 },
			range = 25,
			color = { 255, 50, 50 },
			brightness = 1.5,
		},
		{
			position = { -4.8, 23.2, -11 },
			range = 25,
			color = { 255, 50, 50 },
			brightness = 1.5,
		},
	},
	spotlights = {},
	waypoints = {
		{ -0.05, 2.4, -0.725 },
		{ 7.2, 2.4, -12.8 },
		{ 26.4, 2.4, -12.8 },
	},
	sounds = {
		{
			position = { 0, 33.6, -12.8 },
			ambience = 6,
			range = 6,
		},
	},
	screens = {},
	props = {},
	playerStarts = {},
}
