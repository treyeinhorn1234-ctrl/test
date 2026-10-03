--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room2poffices",
	description = "A two-door hallway with three labeled offices (Harp, Maynard, & Gears).",
	shape = "2",
	commonness = 0,
	large = false,
	disableDecals = false,
	zones = { 3 },
	asset = "room2poffices",
	boundsMin = { -12.8, 0, -25.6 },
	boundsMax = { 24.4, 10.9708, 25.6 },
	triggerBoxes = {},
	lights = {
		{
			position = { -0.0261, 9.3239, 0 },
			range = 15,
			color = { 255, 255, 255 },
			brightness = 1,
		},
		{
			position = { -0.0261, 9.3239, 19.2 },
			range = 15,
			color = { 255, 255, 255 },
			brightness = 1,
		},
		{
			position = { -0.0261, 9.3239, -19.2 },
			range = 15,
			color = { 255, 255, 255 },
			brightness = 1,
		},
		{
			position = { 18.0261, 9.3239, 12.8 },
			range = 15,
			color = { 255, 255, 255 },
			brightness = 1,
		},
		{
			position = { 18.0261, 9.3239, -12 },
			range = 15,
			color = { 255, 255, 255 },
			brightness = 1,
		},
	},
	spotlights = {},
	waypoints = {
		{ 11.2, 0.9, -11.2 },
		{ 0, 0.9, 0 },
		{ 11.2, 0.9, 14.4 },
	},
	sounds = {},
	screens = {
		{
			position = { 6.4688, 7.4, -16.3562 },
			image = "maynard.sc",
		},
	},
	props = {},
	playerStarts = {},
}
