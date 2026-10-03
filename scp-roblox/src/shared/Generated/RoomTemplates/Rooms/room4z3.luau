--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room4z3",
	description = "A 4-door hallway.",
	shape = "4",
	commonness = 100,
	large = false,
	disableDecals = false,
	zones = { 3 },
	asset = "room4z3",
	boundsMin = { -25.6, -0.025, -25.6 },
	boundsMax = { 25.6, 36, 25.6 },
	triggerBoxes = {},
	lights = {
		{
			position = { 0, 11.6, 8.5022 },
			range = 12.5,
			color = { 255, 255, 255 },
			brightness = 1.4,
		},
		{
			position = { -0.0019, 11.6, -8.4984 },
			range = 12.5,
			color = { 255, 255, 255 },
			brightness = 1.4,
		},
	},
	spotlights = {},
	waypoints = {
		{ 8, 2, -0.0063 },
		{ 0, 2, 7.9938 },
		{ -8, 2, 0.0063 },
		{ 0, 2, -7.9938 },
	},
	sounds = {
		{
			position = { 0, 33.2, -0.0063 },
			ambience = 8,
			range = 4,
		},
	},
	screens = {},
	props = {},
	playerStarts = {},
}
