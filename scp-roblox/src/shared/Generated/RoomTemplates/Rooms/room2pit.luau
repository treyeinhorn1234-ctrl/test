--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room2pit",
	description = "A two-door catwalk, where the catwalk spews gas.",
	shape = "2",
	commonness = 75,
	large = false,
	disableDecals = true,
	zones = { 2 },
	asset = "room2pit",
	boundsMin = { -25.6, -11.2, -25.6 },
	boundsMax = { 19.2, 11.2, 25.6 },
	triggerBoxes = {},
	lights = {
		{
			position = { 0, 0, 0 },
			range = 10,
			color = { 255, 255, 255 },
			brightness = 0.8,
		},
		{
			position = { 0, 0, 0 },
			range = 10,
			color = { 255, 255, 255 },
			brightness = 0.8,
		},
		{
			position = { 0, 0, 0 },
			range = 10,
			color = { 255, 255, 255 },
			brightness = 0.8,
		},
		{
			position = { 0, 0, 0 },
			range = 10,
			color = { 255, 255, 255 },
			brightness = 0.8,
		},
		{
			position = { -18.0761, -5.1, -0.0761 },
			range = 12.5,
			color = { 255, 220, 220 },
			brightness = 1.2,
		},
		{
			position = { 18.0761, -5.1, -0.0761 },
			range = 12.5,
			color = { 255, 220, 220 },
			brightness = 1.2,
		},
		{
			position = { -0.0239, 9.3, 6.4239 },
			range = 12.5,
			color = { 255, 255, 255 },
			brightness = 1.2,
		},
		{
			position = { -0.0239, 9.3, -6.3761 },
			range = 12.5,
			color = { 255, 255, 255 },
			brightness = 1.2,
		},
		{
			position = { -0.0239, 9.3, -19.1761 },
			range = 12.5,
			color = { 255, 255, 255 },
			brightness = 1.2,
		},
		{
			position = { -0.0239, 9.3, 19.2239 },
			range = 12.5,
			color = { 255, 255, 255 },
			brightness = 1.2,
		},
	},
	spotlights = {},
	waypoints = {
		{ 0, 0.8, 0.025 },
		{ 0, 0.8, 19.225 },
		{ 12.8, 0.8, 20.825 },
	},
	sounds = {},
	screens = {},
	props = {},
	playerStarts = {},
}
